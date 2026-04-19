"""Spread arbitrage strategy — dual-leg mean reversion on cointegrated pairs."""

import numpy as np
import pandas as pd
from pydantic import BaseModel


class SpreadArbitrageParams(BaseModel):
    window: int = 60
    entry_z: float = 2.0
    exit_z: float = 0.3
    stop_loss_z: float = 4.0
    hedge_ratio: float = 1.0


def build_spread(
    leg1: pd.Series, leg2: pd.Series, hedge_ratio: float = 1.0
) -> pd.Series:
    """Build spread series: leg1 - hedge_ratio * leg2."""
    return leg1 - hedge_ratio * leg2


def generate_signals(
    spread: pd.Series, params: SpreadArbitrageParams
) -> tuple[pd.Series, pd.Series]:
    """Generate entry/exit signals for spread arbitrage."""
    rolling_mean = spread.rolling(params.window).mean()
    rolling_std = spread.rolling(params.window).std().replace(0, np.nan)
    zscore = (spread - rolling_mean) / rolling_std
    zscore = zscore.fillna(0)

    entries = zscore.abs() >= params.entry_z
    exits = (zscore.abs() <= params.exit_z) | (zscore.abs() >= params.stop_loss_z)

    return entries, exits
