"""Walk-forward validation for backtest strategies."""

from pydantic import BaseModel
from backtest import run_backtest, BacktestRequest, BacktestLeg
import math


class WalkForwardRequest(BaseModel):
    legs: list[BacktestLeg]
    prices: dict[str, list[float]]
    dates: list[str]
    entry_threshold: float = 2.0
    exit_threshold: float = 0.5
    window: int = 60
    n_splits: int = 5
    train_ratio: float = 0.7


class SplitResult(BaseModel):
    split: int
    train_sharpe: float
    test_sharpe: float
    test_win_rate: float
    test_max_drawdown: float
    test_trade_count: int


class WalkForwardResult(BaseModel):
    splits: list[SplitResult]
    avg_oos_sharpe: float
    sharpe_cv: float  # coefficient of variation of OOS Sharpe
    stable: bool  # CV < 0.5
    overall_score: float  # 0-100


def _safe(v: float) -> float:
    if math.isnan(v) or math.isinf(v):
        return 0.0
    return v


def run_walk_forward(req: WalkForwardRequest) -> WalkForwardResult:
    """Run walk-forward validation with n_splits."""
    n = len(req.dates)
    split_size = n // req.n_splits
    if split_size < req.window + 20:
        raise ValueError(f"Not enough data for {req.n_splits} splits (need {req.window + 20} per split, have {split_size})")

    splits: list[SplitResult] = []

    for i in range(req.n_splits):
        start = i * split_size
        end = min(start + split_size, n)
        train_end = start + int((end - start) * req.train_ratio)

        # Train period
        train_dates = req.dates[start:train_end]
        train_prices = {k: v[start:train_end] for k, v in req.prices.items()}

        # Test period
        test_dates = req.dates[train_end:end]
        test_prices = {k: v[train_end:end] for k, v in req.prices.items()}

        train_sharpe = 0.0
        test_sharpe = 0.0
        test_wr = 0.0
        test_dd = 0.0
        test_tc = 0

        # Run on train
        try:
            train_bt = run_backtest(BacktestRequest(
                hypothesis_id=f"wf_train_{i}",
                legs=req.legs, prices=train_prices, dates=train_dates,
                entry_threshold=req.entry_threshold,
                exit_threshold=req.exit_threshold,
                window=req.window,
            ))
            train_sharpe = _safe(train_bt.sharpe_ratio)
        except Exception:
            pass

        # Run on test (out-of-sample)
        try:
            test_bt = run_backtest(BacktestRequest(
                hypothesis_id=f"wf_test_{i}",
                legs=req.legs, prices=test_prices, dates=test_dates,
                entry_threshold=req.entry_threshold,
                exit_threshold=req.exit_threshold,
                window=req.window,
            ))
            test_sharpe = _safe(test_bt.sharpe_ratio)
            test_wr = _safe(test_bt.win_rate)
            test_dd = _safe(test_bt.max_drawdown)
            test_tc = test_bt.trade_count
        except Exception:
            pass

        splits.append(SplitResult(
            split=i, train_sharpe=train_sharpe, test_sharpe=test_sharpe,
            test_win_rate=test_wr, test_max_drawdown=test_dd,
            test_trade_count=test_tc,
        ))

    # Aggregate OOS metrics
    oos_sharpes = [s.test_sharpe for s in splits]
    avg_oos = sum(oos_sharpes) / len(oos_sharpes) if oos_sharpes else 0
    std_oos = math.sqrt(sum((s - avg_oos) ** 2 for s in oos_sharpes) / max(len(oos_sharpes), 1))
    cv = std_oos / max(abs(avg_oos), 0.01)
    stable = cv < 0.5 and avg_oos > 0

    # Score: 0-100 based on avg OOS Sharpe and stability
    sharpe_score = min(50, max(0, avg_oos * 25))  # 0-50 from Sharpe
    stability_score = max(0, 50 - cv * 50)  # 0-50 from stability
    overall = round(sharpe_score + stability_score)

    return WalkForwardResult(
        splits=splits, avg_oos_sharpe=round(avg_oos, 3),
        sharpe_cv=round(cv, 3), stable=stable, overall_score=overall,
    )
