"""Channel breakout strategy — Donchian channel breakout with ATR trailing stop."""

import numpy as np
import pandas as pd
from pydantic import BaseModel


class ChannelBreakoutParams(BaseModel):
    channel_period: int = 40
    atr_period: int = 14
    atr_stop_mult: float = 2.0


def generate_signals(
    prices: pd.Series, params: ChannelBreakoutParams
) -> tuple[pd.Series, pd.Series]:
    """Generate entry/exit signals for Donchian channel breakout."""
    n = params.channel_period

    # Donchian channel
    upper = prices.rolling(n).max()
    lower = prices.rolling(n).min()
    mid = (upper + lower) / 2

    # ATR for trailing stop
    high_low = prices.rolling(2).max() - prices.rolling(2).min()
    atr = high_low.rolling(params.atr_period).mean()

    # Entry: price breaks above upper channel (long) or below lower channel (short)
    entries = (prices >= upper.shift(1)) | (prices <= lower.shift(1))

    # Exit: ATR trailing stop (not mid-channel revert, which fires too early)
    trailing_stop_long = prices.rolling(n).max() - atr * params.atr_stop_mult
    trailing_stop_short = prices.rolling(n).min() + atr * params.atr_stop_mult

    exits = (prices <= trailing_stop_long) | (prices >= trailing_stop_short)

    # Prevent exit on same bar as entry
    entries = entries.fillna(False)
    exits = exits.fillna(False)
    exits = exits & ~entries

    return entries, exits
