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


# ── Strategy-specific parameter grids ──

STRATEGY_GRIDS: dict[str, dict[str, list]] = {
    "mean_reversion": {
        "entry_z": [1.0, 1.5, 2.0, 2.5],
        "exit_z": [0.3, 0.5, 0.8, 1.0],
        "window": [30, 40, 60, 90],
    },
    "momentum_breakout": {
        "lookback": [10, 20, 40],
        "entry_percentile": [75, 80, 85, 90],
        "trailing_atr_mult": [1.5, 2.0, 3.0],
    },
    "channel_breakout": {
        "channel_period": [20, 40, 60],
        "atr_period": [14, 20],
        "atr_stop_mult": [1.5, 2.0, 2.5],
    },
    "event_driven": {
        "hold_days": [3, 5, 10, 20],
        "target_pct": [2, 3, 5],
        "stop_pct": [1, 2, 3],
    },
}


class ParamGrid(BaseModel):
    entry_thresholds: list[float] = [1.5, 2.0, 2.5, 3.0]
    exit_thresholds: list[float] = [0.3, 0.5, 0.8]
    windows: list[int] = [40, 60, 90, 120]


class OptimizeRequest(BaseModel):
    legs: list[BacktestLeg]
    prices: dict[str, list[float]]
    dates: list[str]
    param_grid: ParamGrid = ParamGrid()
    strategy_type: str = "mean_reversion"


class ParamResult(BaseModel):
    entry_threshold: float = 0
    exit_threshold: float = 0
    window: int = 0
    sharpe_ratio: float = 0
    max_drawdown: float = 0
    win_rate: float = 0
    total_return: float = 0
    trade_count: int = 0
    # Strategy-specific best params
    strategy_params: dict = {}


class OptimizeResult(BaseModel):
    best_params: ParamResult
    top_results: list[ParamResult]
    total_combinations: int
    stable: bool


def run_optimize(req: OptimizeRequest) -> OptimizeResult:
    """Run grid search over parameter combinations for the given strategy."""
    results: list[ParamResult] = []
    strategy = req.strategy_type

    if strategy == "mean_reversion":
        # Legacy grid search for mean reversion
        combos = list(itertools.product(
            req.param_grid.entry_thresholds,
            req.param_grid.exit_thresholds,
            req.param_grid.windows,
        ))
        for entry_z, exit_z, window in combos:
            if exit_z >= entry_z:
                continue
            if window > len(req.dates):
                continue
            try:
                bt = run_backtest(BacktestRequest(
                    hypothesis_id="optimize", legs=req.legs, prices=req.prices, dates=req.dates,
                    entry_threshold=entry_z, exit_threshold=exit_z, window=window,
                    strategy_type="mean_reversion",
                ))
                results.append(ParamResult(
                    entry_threshold=entry_z, exit_threshold=exit_z, window=window,
                    sharpe_ratio=_safe(bt.sharpe_ratio), max_drawdown=_safe(bt.max_drawdown),
                    win_rate=_safe(bt.win_rate), total_return=_safe(bt.total_return),
                    trade_count=bt.trade_count,
                    strategy_params={"entry_z": entry_z, "exit_z": exit_z, "window": window},
                ))
            except Exception:
                continue
    else:
        # Generic grid search for other strategies
        grid = STRATEGY_GRIDS.get(strategy, {})
        if not grid:
            raise ValueError(f"No parameter grid for strategy: {strategy}")

        keys = list(grid.keys())
        values = [grid[k] for k in keys]
        combos = list(itertools.product(*values))

        for combo in combos:
            params = dict(zip(keys, combo))
            try:
                bt = run_backtest(BacktestRequest(
                    hypothesis_id="optimize", legs=req.legs, prices=req.prices, dates=req.dates,
                    strategy_type=strategy, strategy_params=params,
                ))
                results.append(ParamResult(
                    sharpe_ratio=_safe(bt.sharpe_ratio), max_drawdown=_safe(bt.max_drawdown),
                    win_rate=_safe(bt.win_rate), total_return=_safe(bt.total_return),
                    trade_count=bt.trade_count, strategy_params=params,
                ))
            except Exception:
                continue

    if not results:
        raise ValueError("No valid parameter combinations produced results")

    results.sort(key=lambda r: r.sharpe_ratio, reverse=True)
    top = results[:10]
    best = top[0]

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
