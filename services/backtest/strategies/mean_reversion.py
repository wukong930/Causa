"""Mean reversion strategy — enter when z-score exceeds threshold, exit on reversion."""

import numpy as np
import pandas as pd
from pydantic import BaseModel


class MeanReversionParams(BaseModel):
    window: int = 60
    entry_z: float = 2.0
    exit_z: float = 0.5
    stop_loss_z: float = 3.5


def generate_signals(
    spread: pd.Series, params: MeanReversionParams
) -> tuple[pd.Series, pd.Series]:
    """Generate entry/exit signals for mean reversion."""
    rolling_mean = spread.rolling(params.window).mean()
    rolling_std = spread.rolling(params.window).std().replace(0, np.nan)
    zscore = (spread - rolling_mean) / rolling_std
    zscore = zscore.fillna(0)

    # Short when z > entry (spread too high), long when z < -entry
    entries = (zscore >= params.entry_z) | (zscore <= -params.entry_z)
    exits = (zscore.abs() <= params.exit_z) | (zscore.abs() >= params.stop_loss_z)

    # Prevent exit on same bar as entry
    entries = entries.fillna(False)
    exits = exits.fillna(False)
    exits = exits & ~entries

    return entries, exits
