"""Momentum strategy — enter on breakout, exit on reversal."""

import numpy as np
import pandas as pd
from pydantic import BaseModel


class MomentumParams(BaseModel):
    lookback: int = 20
    entry_percentile: float = 80.0
    exit_percentile: float = 50.0
    atr_period: int = 14


def generate_signals(
    prices: pd.Series, params: MomentumParams
) -> tuple[pd.Series, pd.Series]:
    """Generate entry/exit signals for momentum breakout."""
    returns = prices.pct_change(params.lookback)
    upper = returns.rolling(params.lookback).quantile(params.entry_percentile / 100)
    lower = returns.rolling(params.lookback).quantile((100 - params.entry_percentile) / 100)

    entries = (returns >= upper) | (returns <= lower)
    mid = returns.rolling(params.lookback).quantile(params.exit_percentile / 100)
    exits = returns.abs() <= mid.abs()

    return entries.fillna(False), exits.fillna(False)
