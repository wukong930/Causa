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

    # Exit: price reverts to mid-channel OR ATR stop triggered
    # For longs: exit when price drops below (high - atr * mult)
    # For shorts: exit when price rises above (low + atr * mult)
    trailing_stop_long = prices.rolling(n).max() - atr * params.atr_stop_mult
    trailing_stop_short = prices.rolling(n).min() + atr * params.atr_stop_mult

    exits = (
        (prices <= mid) |  # revert to mid
        (prices <= trailing_stop_long) |  # long stop
        (prices >= trailing_stop_short)  # short stop
    )

    return entries.fillna(False), exits.fillna(False)
