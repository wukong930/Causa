"""vectorbt-based backtesting engine."""

import numpy as np
import pandas as pd
import vectorbt as vbt
from pydantic import BaseModel
from typing import Optional


class BacktestLeg(BaseModel):
    asset: str
    direction: str  # "long" | "short"
    ratio: float = 1.0


class BacktestRequest(BaseModel):
    hypothesis_id: str
    legs: list[BacktestLeg]
    prices: dict[str, list[float]]  # symbol → daily close prices
    dates: list[str]  # ISO date strings
    entry_threshold: float = 2.0
    exit_threshold: float = 0.0
    stop_loss_threshold: float = -3.0
    window: int = 60


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
        )

    spread = _build_spread_series(req.prices, req.legs, dates)

    # Z-score
    rolling_mean = spread.rolling(req.window).mean()
    rolling_std = spread.rolling(req.window).std()
    rolling_std = rolling_std.replace(0, np.nan)
    zscore = (spread - rolling_mean) / rolling_std
    zscore = zscore.fillna(0)

    # Entry/exit signals
    entries = zscore >= req.entry_threshold
    exits = zscore <= req.exit_threshold

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

    # IC: correlation between z-score and next-day return
    ret = spread.pct_change().shift(-1)
    valid = zscore.notna() & ret.notna()
    ic = float(zscore[valid].corr(ret[valid])) if valid.sum() > 10 else 0.0

    sharpe = float(stats.get("Sharpe Ratio", 0) or 0)
    max_dd = float(stats.get("Max Drawdown [%]", 0) or 0) / -100
    total_ret = float(stats.get("Total Return [%]", 0) or 0) / 100
    win_rate = float(stats.get("Win Rate [%]", 0) or 0) / 100

    avg_hold = 0.0
    if trade_count > 0 and "Duration" in trades.columns:
        avg_hold = float(trades["Duration"].dt.days.mean())

    calmar = abs(total_ret / max_dd) if max_dd != 0 else 0.0
    profit_factor = float(stats.get("Profit Factor", 0) or 0)

    return BacktestResult(
        hypothesis_id=req.hypothesis_id,
        sharpe_ratio=round(sharpe, 3),
        max_drawdown=round(max_dd, 4),
        win_rate=round(win_rate, 3),
        total_return=round(total_ret, 4),
        avg_holding_days=round(avg_hold, 1),
        trade_count=trade_count,
        ic=round(ic, 4),
        calmar_ratio=round(calmar, 3),
        profit_factor=round(profit_factor, 3),
    )
