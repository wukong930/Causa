"""Event-driven strategy — fixed holding period with target/stop."""

import numpy as np
import pandas as pd
from pydantic import BaseModel


class EventDrivenParams(BaseModel):
    hold_days: int = 5
    target_pct: float = 3.0  # take profit at +3%
    stop_pct: float = 2.0    # stop loss at -2%


def generate_signals(
    prices: pd.Series, params: EventDrivenParams
) -> tuple[pd.Series, pd.Series]:
    """Generate entry/exit signals for event-driven fixed-hold strategy.

    Entry: significant daily move (>1 std of recent returns) signals event impact.
    Exit: after hold_days, or if target/stop hit earlier.
    """
    returns = prices.pct_change()
    vol = returns.rolling(20).std()

    # Entry: daily return exceeds 1 std (event shock detected)
    entries = returns.abs() > vol

    # Exit logic: hold for N days, or hit target/stop
    exits = pd.Series(False, index=prices.index)
    entry_price = pd.Series(np.nan, index=prices.index)

    in_trade = False
    trade_entry_idx = 0
    trade_entry_price = 0.0

    for i in range(len(prices)):
        if not in_trade and entries.iloc[i]:
            in_trade = True
            trade_entry_idx = i
            trade_entry_price = prices.iloc[i]
        elif in_trade:
            days_held = i - trade_entry_idx
            pnl_pct = ((prices.iloc[i] - trade_entry_price) / trade_entry_price) * 100

            if (days_held >= params.hold_days or
                pnl_pct >= params.target_pct or
                pnl_pct <= -params.stop_pct):
                exits.iloc[i] = True
                in_trade = False

    return entries.fillna(False), exits
