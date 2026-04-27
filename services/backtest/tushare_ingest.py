"""Tushare Pro data ingestion for Chinese commodity futures.

Provides richer data than AkShare: settle price, OI change, turnover amount.
Used as primary data source with AkShare as fallback.
"""

import os
import time
import tushare as ts
from pydantic import BaseModel
from datetime import datetime, timedelta

# Reuse MarketBar from akshare_ingest
from akshare_ingest import MarketBar, SYMBOL_EXCHANGE

TOKEN = os.environ.get("TUSHARE_TOKEN", "")

# Our exchange name → Tushare exchange suffix
_EXCHANGE_SUFFIX = {
    "SHFE": "SHF",
    "DCE": "DCE",
    "CZCE": "ZCE",
    "INE": "INE",
    "GFEX": "GFE",
    "CFFEX": "CFX",
}


class TushareBar(BaseModel):
    """Extended market bar with Tushare-specific fields."""
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float
    open_interest: float
    symbol: str
    settle: float = 0
    oi_chg: float = 0
    amount: float = 0


def _get_pro():
    """Get Tushare pro API instance."""
    if not TOKEN:
        raise ValueError("TUSHARE_TOKEN not set")
    return ts.pro_api(TOKEN)


def get_ts_code(symbol: str) -> str | None:
    """Convert our symbol (e.g. 'RB') to Tushare ts_code (e.g. 'RB.SHF')."""
    sym = symbol.upper()
    exchange = SYMBOL_EXCHANGE.get(sym)
    if not exchange:
        return None
    suffix = _EXCHANGE_SUFFIX.get(exchange)
    if not suffix:
        return None
    return f"{sym}.{suffix}"


def get_main_contract(symbol: str) -> str | None:
    """Get current main contract code via fut_mapping."""
    ts_code = get_ts_code(symbol)
    if not ts_code:
        return None
    try:
        pro = _get_pro()
        df = pro.fut_mapping(ts_code=ts_code)
        if df is None or df.empty:
            return None
        latest = df.sort_values("trade_date", ascending=False).iloc[0]
        return latest["mapping_ts_code"]
    except Exception as e:
        print(f"[tushare] Main contract lookup failed for {symbol}: {e}")
        return None


def fetch_daily_tushare(symbol: str, days: int = 5) -> list[TushareBar]:
    """Fetch daily bars from Tushare for a symbol's main contract."""
    main = get_main_contract(symbol)
    if not main:
        return []

    end = datetime.now().strftime("%Y%m%d")
    start = (datetime.now() - timedelta(days=days + 10)).strftime("%Y%m%d")

    try:
        pro = _get_pro()
        df = pro.fut_daily(ts_code=main, start_date=start, end_date=end)
        if df is None or df.empty:
            return []

        bars: list[TushareBar] = []
        for _, row in df.iterrows():
            d = str(row["trade_date"])
            date_str = f"{d[:4]}-{d[4:6]}-{d[6:8]}"
            bars.append(TushareBar(
                date=date_str,
                open=float(row.get("open", 0)),
                high=float(row.get("high", 0)),
                low=float(row.get("low", 0)),
                close=float(row.get("close", 0)),
                volume=float(row.get("vol", 0)),
                open_interest=float(row.get("oi", 0)),
                symbol=symbol.upper(),
                settle=float(row.get("settle", 0)),
                oi_chg=float(row.get("oi_chg", 0)),
                amount=float(row.get("amount", 0)),
            ))
        return sorted(bars, key=lambda b: b.date)
    except Exception as e:
        print(f"[tushare] Daily fetch failed for {symbol}: {e}")
        return []


def fetch_daily_as_market_bar(symbol: str, days: int = 5) -> list[MarketBar]:
    """Fetch daily bars and return as standard MarketBar (for compatibility)."""
    tushare_bars = fetch_daily_tushare(symbol, days)
    return [
        MarketBar(
            date=b.date, open=b.open, high=b.high, low=b.low,
            close=b.close, volume=b.volume, open_interest=b.open_interest,
            symbol=b.symbol,
        )
        for b in tushare_bars
    ]


def fetch_all_daily_tushare(days: int = 5) -> dict[str, list[TushareBar]]:
    """Fetch daily bars for all domestic symbols. Respects Tushare rate limit."""
    result: dict[str, list[TushareBar]] = {}
    domestic = [s for s, ex in SYMBOL_EXCHANGE.items() if ex != "CFFEX"]

    for i, symbol in enumerate(domestic):
        bars = fetch_daily_tushare(symbol, days)
        if bars:
            result[symbol] = bars
        # Tushare rate limit: ~200 calls/min, each symbol = 2 calls (mapping + daily)
        if (i + 1) % 30 == 0:
            time.sleep(1)

    print(f"[tushare] Fetched {len(result)} symbols, {sum(len(v) for v in result.values())} total bars")
    return result
