"""Advanced backtest metrics — Sortino, Omega, tail ratio, equity curve, trade extraction."""

import numpy as np
import pandas as pd
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import vectorbt as vbt


def calculate_sortino(returns: pd.Series, target: float = 0.0) -> float:
    """Sortino ratio: excess return / downside deviation."""
    excess = returns - target
    downside = returns[returns < target]
    if len(downside) < 2:
        return 0.0
    downside_std = float(np.sqrt(np.mean(downside ** 2)))
    if downside_std == 0:
        return 0.0
    return float(excess.mean() / downside_std * np.sqrt(252))


def calculate_omega(returns: pd.Series, threshold: float = 0.0) -> float:
    """Omega ratio: probability-weighted gains / losses."""
    gains = returns[returns > threshold] - threshold
    losses = threshold - returns[returns <= threshold]
    loss_sum = float(losses.sum())
    if loss_sum == 0:
        return 0.0
    return float(gains.sum() / loss_sum)


def calculate_tail_ratio(returns: pd.Series) -> float:
    """Tail ratio: 95th percentile / abs(5th percentile)."""
    if len(returns) < 20:
        return 0.0
    p95 = float(np.percentile(returns.dropna(), 95))
    p5 = float(np.abs(np.percentile(returns.dropna(), 5)))
    if p5 == 0:
        return 0.0
    return p95 / p5


def build_equity_curve(pf) -> list[dict]:
    """Extract equity curve as list of {date, equity, drawdown}."""
    try:
        equity = pf.value()
        dd = pf.drawdown()
        points = []
        for i in range(len(equity)):
            points.append({
                "date": str(equity.index[i].date()),
                "equity": round(float(equity.iloc[i]), 2),
                "drawdown": round(float(dd.iloc[i]), 4),
            })
        return points
    except Exception:
        return []


def extract_trades(pf) -> list[dict]:
    """Extract trade records from portfolio."""
    try:
        records = pf.trades.records_readable
        if records is None or len(records) == 0:
            return []
        trades = []
        for _, row in records.iterrows():
            entry_date = str(row.get("Entry Timestamp", row.get("Entry Date", "")))
            exit_date = str(row.get("Exit Timestamp", row.get("Exit Date", "")))
            pnl = float(row.get("PnL", 0))
            ret = float(row.get("Return", 0))
            duration = row.get("Duration", pd.Timedelta(0))
            days = int(duration.days) if hasattr(duration, "days") else 0
            trades.append({
                "entry_date": entry_date[:10],
                "exit_date": exit_date[:10],
                "direction": "long",
                "pnl": round(pnl, 2),
                "return_pct": round(ret * 100, 2),
                "holding_days": days,
            })
        return trades
    except Exception:
        return []


def max_drawdown_duration(pf) -> int:
    """Maximum drawdown duration in days."""
    try:
        dd = pf.drawdown()
        in_dd = dd < 0
        max_dur = 0
        current = 0
        for v in in_dd:
            if v:
                current += 1
                max_dur = max(max_dur, current)
            else:
                current = 0
        return max_dur
    except Exception:
        return 0
