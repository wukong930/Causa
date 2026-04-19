"""Parameter grid search optimizer for backtest strategies."""

from pydantic import BaseModel
from backtest import run_backtest, BacktestRequest, BacktestLeg
import itertools
import math


def _safe(v: float) -> float:
    """Replace NaN/Inf with 0."""
    if math.isnan(v) or math.isinf(v):
        return 0.0
    return v


class ParamGrid(BaseModel):
    entry_thresholds: list[float] = [1.5, 2.0, 2.5, 3.0]
    exit_thresholds: list[float] = [0.3, 0.5, 0.8]
    windows: list[int] = [40, 60, 90, 120]


class OptimizeRequest(BaseModel):
    legs: list[BacktestLeg]
    prices: dict[str, list[float]]
    dates: list[str]
    param_grid: ParamGrid = ParamGrid()


class ParamResult(BaseModel):
    entry_threshold: float
    exit_threshold: float
    window: int
    sharpe_ratio: float
    max_drawdown: float
    win_rate: float
    total_return: float
    trade_count: int


class OptimizeResult(BaseModel):
    best_params: ParamResult
    top_results: list[ParamResult]
    total_combinations: int
    stable: bool  # True if top 3 results have similar Sharpe


def run_optimize(req: OptimizeRequest) -> OptimizeResult:
    """Run grid search over parameter combinations."""
    results: list[ParamResult] = []

    combos = list(itertools.product(
        req.param_grid.entry_thresholds,
        req.param_grid.exit_thresholds,
        req.param_grid.windows,
    ))

    for entry_z, exit_z, window in combos:
        if exit_z >= entry_z:
            continue  # exit must be below entry
        if window > len(req.dates):
            continue  # not enough data

        try:
            bt_req = BacktestRequest(
                hypothesis_id="optimize",
                legs=req.legs,
                prices=req.prices,
                dates=req.dates,
                entry_threshold=entry_z,
                exit_threshold=exit_z,
                window=window,
            )
            bt = run_backtest(bt_req)
            results.append(ParamResult(
                entry_threshold=entry_z, exit_threshold=exit_z, window=window,
                sharpe_ratio=_safe(bt.sharpe_ratio), max_drawdown=_safe(bt.max_drawdown),
                win_rate=_safe(bt.win_rate), total_return=_safe(bt.total_return),
                trade_count=bt.trade_count,
            ))
        except Exception:
            continue

    if not results:
        raise ValueError("No valid parameter combinations produced results")

    # Sort by Sharpe descending
    results.sort(key=lambda r: r.sharpe_ratio, reverse=True)
    top = results[:10]
    best = top[0]

    # Stability: top 3 Sharpe ratios within 30% of each other
    stable = False
    if len(top) >= 3:
        sharpes = [r.sharpe_ratio for r in top[:3]]
        if sharpes[0] > 0:
            cv = (max(sharpes) - min(sharpes)) / max(abs(sharpes[0]), 0.01)
            stable = cv < 0.3

    return OptimizeResult(
        best_params=best, top_results=top,
        total_combinations=len(combos), stable=stable,
    )
