"""vectorbt-based backtesting engine with multi-strategy routing."""

import numpy as np
import pandas as pd
import vectorbt as vbt
from pydantic import BaseModel
from typing import Optional

from strategies.mean_reversion import MeanReversionParams, generate_signals as mr_signals
from strategies.momentum import MomentumParams, generate_signals as mom_signals
from strategies.channel_breakout import ChannelBreakoutParams, generate_signals as cb_signals
from strategies.event_driven import EventDrivenParams, generate_signals as ed_signals


class BacktestLeg(BaseModel):
    asset: str
    direction: str  # "long" | "short"
    ratio: float = 1.0


class BacktestRequest(BaseModel):
    hypothesis_id: str
    legs: list[BacktestLeg]
    prices: dict[str, list[float]]  # symbol → daily close prices
    dates: list[str]  # ISO date strings
    # Legacy params (used by mean_reversion if strategy_params not set)
    entry_threshold: float = 2.0
    exit_threshold: float = 0.0
    stop_loss_threshold: float = -3.0
    window: int = 60
    # Multi-strategy fields
    strategy_type: str = "mean_reversion"  # mean_reversion | momentum_breakout | channel_breakout | event_driven
    strategy_params: dict = {}  # override default params per strategy


class EquityPoint(BaseModel):
    date: str
    equity: float
    drawdown: float


class Trade(BaseModel):
    entry_date: str
    exit_date: str
    direction: str
    pnl: float
    return_pct: float
    holding_days: int


class BacktestResult(BaseModel):
    hypothesis_id: str
    sharpe_ratio: float
    max_drawdown: float  # as negative fraction
    win_rate: float
    total_return: float
    avg_holding_days: float
    trade_count: int
    ic: float  # information coefficient
    calmar_ratio: float
    profit_factor: float
    # Advanced metrics
    sortino_ratio: float = 0.0
    omega_ratio: float = 0.0
    max_drawdown_duration: int = 0  # days
    recovery_factor: float = 0.0
    tail_ratio: float = 0.0
    equity_curve: list[EquityPoint] = []
    trades: list[Trade] = []


def _build_spread_series(
    prices: dict[str, list[float]],
    legs: list[BacktestLeg],
    dates: list[str],
) -> pd.Series:
    """Build a spread time series from leg prices."""
    idx = pd.DatetimeIndex(dates)
    spread = pd.Series(0.0, index=idx)
    for leg in legs:
        p = pd.Series(prices.get(leg.asset, [0.0] * len(dates)), index=idx)
        sign = 1.0 if leg.direction == "long" else -1.0
        spread += sign * leg.ratio * p
    return spread


def run_backtest(req: BacktestRequest) -> BacktestResult:
    """Run a mean-reversion backtest using vectorbt."""
    dates = req.dates
    if len(dates) < req.window + 10:
        return BacktestResult(
            hypothesis_id=req.hypothesis_id,
            sharpe_ratio=0, max_drawdown=0, win_rate=0,
            total_return=0, avg_holding_days=0, trade_count=0,
            ic=0, calmar_ratio=0, profit_factor=0,
            sortino_ratio=0, omega_ratio=0, max_drawdown_duration=0,
            recovery_factor=0, tail_ratio=0,
        )

    spread = _build_spread_series(req.prices, req.legs, dates)

    # Guard: vectorbt requires all prices > 0
    if (spread <= 0).any():
        shift = abs(spread.min()) + 1.0
        spread = spread + shift

    # ── Strategy routing: generate entry/exit signals ──
    if req.strategy_type == "momentum_breakout":
        params = MomentumParams(
            lookback=req.strategy_params.get("lookback", 20),
            entry_percentile=req.strategy_params.get("entry_percentile", 80.0),
            trailing_atr_mult=req.strategy_params.get("trailing_atr_mult", 2.0),
            atr_period=req.strategy_params.get("atr_period", 14),
        )
        entries, exits = mom_signals(spread, params)
    elif req.strategy_type == "channel_breakout":
        params = ChannelBreakoutParams(
            channel_period=int(req.strategy_params.get("channel_period", 40)),
            atr_period=int(req.strategy_params.get("atr_period", 14)),
            atr_stop_mult=req.strategy_params.get("atr_stop_mult", 2.0),
        )
        entries, exits = cb_signals(spread, params)
    elif req.strategy_type == "event_driven":
        params = EventDrivenParams(
            hold_days=int(req.strategy_params.get("hold_days", 5)),
            target_pct=req.strategy_params.get("target_pct", 3.0),
            stop_pct=req.strategy_params.get("stop_pct", 2.0),
        )
        entries, exits = ed_signals(spread, params)
    else:
        # Default: mean_reversion (z-score based)
        mr_params = MeanReversionParams(
            window=req.strategy_params.get("window", req.window),
            entry_z=req.strategy_params.get("entry_z", req.entry_threshold),
            exit_z=req.strategy_params.get("exit_z", req.exit_threshold if req.exit_threshold > 0 else 0.5),
            stop_loss_z=req.strategy_params.get("stop_loss_z", abs(req.stop_loss_threshold) if req.stop_loss_threshold != 0 else 3.5),
        )
        entries, exits = mr_signals(spread, mr_params)

    # Run vectorbt portfolio
    pf = vbt.Portfolio.from_signals(
        spread,
        entries=entries,
        exits=exits,
        init_cash=1_000_000,
        fees=0.0003,
        freq="1D",
    )

    stats = pf.stats()
    trades = pf.trades.records_readable if hasattr(pf.trades, "records_readable") else pd.DataFrame()
    trade_count = len(trades) if isinstance(trades, pd.DataFrame) else 0

    # IC: correlation between signal strength and next-day return
    ret = spread.pct_change().shift(-1)
    # Use entries as signal proxy for non-zscore strategies
    signal = entries.astype(float)
    valid = signal.notna() & ret.notna()
    ic = float(signal[valid].corr(ret[valid])) if valid.sum() > 10 else 0.0

    sharpe = float(stats.get("Sharpe Ratio", 0) or 0)
    max_dd = float(stats.get("Max Drawdown [%]", 0) or 0) / -100
    total_ret = float(stats.get("Total Return [%]", 0) or 0) / 100
    win_rate = float(stats.get("Win Rate [%]", 0) or 0) / 100

    # Sanitize NaN/Inf from vectorbt
    import math
    def _s(v: float) -> float:
        return 0.0 if (math.isnan(v) or math.isinf(v)) else v
    sharpe, max_dd, total_ret, win_rate = _s(sharpe), _s(max_dd), _s(total_ret), _s(win_rate)

    avg_hold = 0.0
    if trade_count > 0 and "Duration" in trades.columns:
        avg_hold = float(trades["Duration"].dt.days.mean())

    calmar = abs(total_ret / max_dd) if max_dd != 0 else 0.0
    profit_factor = float(stats.get("Profit Factor", 0) or 0)

    # Advanced metrics
    from advanced_metrics import (
        calculate_sortino, calculate_omega, calculate_tail_ratio,
        build_equity_curve, extract_trades, max_drawdown_duration,
    )
    daily_returns = pf.returns()
    sortino = calculate_sortino(daily_returns)
    omega = calculate_omega(daily_returns)
    tail = calculate_tail_ratio(daily_returns)
    equity = build_equity_curve(pf)
    trade_list = extract_trades(pf)
    dd_duration = max_drawdown_duration(pf)
    recovery = abs(total_ret / max_dd) if max_dd != 0 else 0.0

    return BacktestResult(
        hypothesis_id=req.hypothesis_id,
        sharpe_ratio=round(_s(sharpe), 3),
        max_drawdown=round(_s(max_dd), 4),
        win_rate=round(_s(win_rate), 3),
        total_return=round(_s(total_ret), 4),
        avg_holding_days=round(_s(avg_hold), 1),
        trade_count=trade_count,
        ic=round(_s(ic), 4),
        calmar_ratio=round(_s(calmar), 3),
        profit_factor=round(_s(profit_factor), 3),
        sortino_ratio=round(_s(sortino), 3),
        omega_ratio=round(_s(omega), 3),
        max_drawdown_duration=dd_duration,
        recovery_factor=round(_s(recovery), 3),
        tail_ratio=round(_s(tail), 3),
        equity_curve=equity,
        trades=trade_list,
    )
