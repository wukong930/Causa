"""Momentum strategy — enter on breakout, exit on ATR trailing stop or reversal."""

import numpy as np
import pandas as pd
from pydantic import BaseModel


class MomentumParams(BaseModel):
    lookback: int = 20
    entry_percentile: float = 80.0
    trailing_atr_mult: float = 2.0
    atr_period: int = 14


def generate_signals(
    prices: pd.Series, params: MomentumParams
) -> tuple[pd.Series, pd.Series]:
    """Generate entry/exit signals for momentum breakout with ATR trailing stop."""
    returns = prices.pct_change(params.lookback)
    upper = returns.rolling(params.lookback).quantile(params.entry_percentile / 100)
    lower = returns.rolling(params.lookback).quantile((100 - params.entry_percentile) / 100)

    # Entry: returns break above upper quantile (long) or below lower (short)
    entries = (returns >= upper) | (returns <= lower)

    # ATR trailing stop
    high_low = prices.rolling(2).max() - prices.rolling(2).min()
    atr = high_low.rolling(params.atr_period).mean()

    # Exit: ATR trailing stop only (momentum reversal fires too frequently)
    trailing_stop = prices.rolling(params.lookback).max() - atr * params.trailing_atr_mult

    exits = prices <= trailing_stop

    # Prevent exit on same bar as entry
    entries = entries.fillna(False)
    exits = exits.fillna(False)
    exits = exits & ~entries

    return entries, exits
