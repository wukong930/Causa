"""AkShare data ingestion for Chinese commodity futures."""

import akshare as ak
import pandas as pd
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta

# Exchange → AkShare function mapping
EXCHANGE_MAP = {
    "SHFE": "上期所",
    "DCE": "大商所",
    "CZCE": "郑商所",
    "CFFEX": "中金所",
    "INE": "上期能源",
    "GFEX": "广期所",
}

# Symbol → exchange mapping (major contracts)
SYMBOL_EXCHANGE: dict[str, str] = {
    # Ferrous
    "RB": "SHFE", "HC": "SHFE", "SS": "SHFE",
    "I": "DCE", "J": "DCE", "JM": "DCE",
    "SF": "CZCE", "SM": "CZCE",
    # Non-ferrous
    "CU": "SHFE", "AL": "SHFE", "ZN": "SHFE", "PB": "SHFE",
    "NI": "SHFE", "SN": "SHFE", "AU": "SHFE", "AG": "SHFE",
    "BC": "INE",
    # Energy
    "SC": "INE", "FU": "SHFE", "LU": "SHFE", "BU": "SHFE",
    "PP": "DCE", "TA": "CZCE", "MEG": "DCE", "MA": "CZCE",
    "EB": "DCE", "PG": "DCE", "SA": "CZCE", "UR": "CZCE",
    "V": "DCE", "L": "DCE",
    # Agriculture
    "P": "DCE", "Y": "DCE", "M": "DCE", "OI": "CZCE", "RM": "CZCE",
    "CF": "CZCE", "SR": "CZCE", "AP": "CZCE", "C": "DCE", "CS": "DCE",
    "A": "DCE", "B": "DCE", "JD": "DCE", "LH": "DCE",
    "SP": "SHFE", "PK": "CZCE",
}


class MarketBar(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float
    open_interest: float
    symbol: str


class SymbolInfo(BaseModel):
    symbol: str
    name: str
    exchange: str


def get_main_contract(symbol: str) -> str:
    """Get the main (dominant) contract code for a symbol."""
    return f"{symbol.lower()}0"  # AkShare convention: rb0 = main contract


def fetch_futures_daily(
    symbol: str, days: int = 750
) -> list[MarketBar]:
    """Fetch daily OHLCV for a futures symbol's main contract."""
    sym_upper = symbol.upper()
    if sym_upper not in SYMBOL_EXCHANGE:
        raise ValueError(f"Unknown symbol: {symbol}")

    try:
        df = ak.futures_main_sina(symbol=sym_upper.lower() + "0")
        if df is None or df.empty:
            return []

        df = df.tail(days).reset_index(drop=True)
        bars: list[MarketBar] = []
        for _, row in df.iterrows():
            bars.append(MarketBar(
                date=str(row.get("日期", row.get("date", ""))),
                open=float(row.get("开盘价", row.get("open", 0))),
                high=float(row.get("最高价", row.get("high", 0))),
                low=float(row.get("最低价", row.get("low", 0))),
                close=float(row.get("收盘价", row.get("close", 0))),
                volume=float(row.get("成交量", row.get("volume", 0))),
                open_interest=float(row.get("持仓量", row.get("hold", 0))),
                symbol=sym_upper,
            ))
        return bars
    except Exception as e:
        print(f"[akshare] Error fetching {symbol}: {e}")
        return []


def fetch_all_symbols() -> list[SymbolInfo]:
    """Return all supported symbols with exchange info."""
    results: list[SymbolInfo] = []
    names = _symbol_names()
    for sym, exch in SYMBOL_EXCHANGE.items():
        results.append(SymbolInfo(
            symbol=sym,
            name=names.get(sym, sym),
            exchange=exch,
        ))
    return sorted(results, key=lambda s: s.exchange + s.symbol)


def fetch_spread_data(
    sym1: str, sym2: str, days: int = 750
) -> list[dict]:
    """Fetch daily spread (sym1 - sym2) for two symbols."""
    bars1 = fetch_futures_daily(sym1, days)
    bars2 = fetch_futures_daily(sym2, days)
    if not bars1 or not bars2:
        return []

    df1 = pd.DataFrame([b.model_dump() for b in bars1]).set_index("date")
    df2 = pd.DataFrame([b.model_dump() for b in bars2]).set_index("date")
    merged = df1[["close"]].join(df2[["close"]], lsuffix="_1", rsuffix="_2", how="inner")
    merged["spread"] = merged["close_1"] - merged["close_2"]

    return [
        {"date": idx, "close1": row["close_1"], "close2": row["close_2"], "spread": row["spread"]}
        for idx, row in merged.iterrows()
    ]


class TermStructurePoint(BaseModel):
    contract: str
    contract_month: str  # e.g. "2510"
    price: float
    volume: float
    open_interest: float


def fetch_term_structure(symbol: str) -> list[TermStructurePoint]:
    """Fetch term structure (all active contract months) for a symbol."""
    sym_upper = symbol.upper()
    if sym_upper not in SYMBOL_EXCHANGE:
        raise ValueError(f"Unknown symbol: {symbol}")

    cn_name = _symbol_names().get(sym_upper)
    if not cn_name:
        return []

    try:
        # Try Chinese name first, fall back to English symbol
        df = None
        for name in [cn_name, sym_upper]:
            try:
                df = ak.futures_zh_realtime(symbol=name)
                if df is not None and not df.empty:
                    break
            except Exception:
                continue
        if df is None or df.empty:
            return []

        points: list[TermStructurePoint] = []
        for _, row in df.iterrows():
            contract = str(row.get("symbol", ""))
            # Skip continuous contract (e.g. RB0)
            if contract.endswith("0") and not any(c.isdigit() for c in contract[:-1][-2:]):
                continue
            price = float(row.get("trade", 0))
            vol = float(row.get("volume", 0))
            oi = float(row.get("position", 0))
            # Extract contract month from symbol like RB2510 -> 2510
            month = contract.replace(sym_upper, "")
            if price > 0 and month:
                points.append(TermStructurePoint(
                    contract=contract, contract_month=month,
                    price=price, volume=vol, open_interest=oi,
                ))
        return sorted(points, key=lambda p: p.contract)
    except Exception as e:
        print(f"[akshare] Term structure error for {symbol}: {e}")
        return []


def _symbol_names() -> dict[str, str]:
    """Chinese names matching AkShare futures_zh_realtime() symbol parameter.
    Must match the 'symbol' column from ak.futures_symbol_mark()."""
    return {
        "RB": "螺纹钢", "HC": "热轧卷板", "SS": "不锈钢", "I": "铁矿石",
        "J": "焦炭", "JM": "焦煤", "SF": "硅铁", "SM": "锰硅",
        "CU": "沪铜", "AL": "沪铝", "ZN": "沪锌", "PB": "沪铅",
        "NI": "沪镍", "SN": "沪锡", "AU": "黄金", "AG": "白银", "BC": "国际铜",
        "SC": "原油", "FU": "燃油", "LU": "低硫燃料油", "BU": "沥青",
        "PP": "PP", "TA": "PTA", "MEG": "乙二醇", "MA": "郑醇",
        "EB": "苯乙烯", "PG": "液化石油气", "SA": "纯碱", "UR": "尿素",
        "V": "PVC", "L": "塑料",
        "P": "棕榈", "Y": "豆油", "M": "豆粕", "OI": "菜油", "RM": "菜粕",
        "CF": "棉花", "SR": "白糖", "AP": "鲜苹果", "C": "玉米", "CS": "玉米淀粉",
        "A": "豆一", "B": "豆二", "JD": "鸡蛋", "LH": "生猪",
        "SP": "纸浆", "PK": "花生",
    }


class RealtimeQuote(BaseModel):
    symbol: str
    price: float
    open: float
    high: float
    low: float
    volume: float
    change_pct: float
    timestamp: str


def fetch_realtime_quotes() -> list[RealtimeQuote]:
    """Fetch realtime snapshot for all major futures contracts via AkShare."""
    quotes: list[RealtimeQuote] = []
    names = _symbol_names()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    for symbol, exchange in SYMBOL_EXCHANGE.items():
        cn_name = names.get(symbol, symbol)
        try:
            df = ak.futures_zh_realtime(symbol=cn_name)
            if df is None or df.empty:
                continue
            # Find the main contract (highest volume)
            if "volume" in df.columns:
                df = df.sort_values("volume", ascending=False)
            row = df.iloc[0]
            price = float(row.get("trade", 0) or row.get("current_price", 0))
            if price <= 0:
                continue
            open_p = float(row.get("open", price))
            high_p = float(row.get("high", price))
            low_p = float(row.get("low", price))
            vol = float(row.get("volume", 0))
            # Change percent
            pre_close = float(row.get("settlement", 0) or row.get("pre_settle", 0))
            chg_pct = ((price - pre_close) / pre_close * 100) if pre_close > 0 else 0.0

            quotes.append(RealtimeQuote(
                symbol=symbol, price=price, open=open_p,
                high=high_p, low=low_p, volume=vol,
                change_pct=round(chg_pct, 3), timestamp=now,
            ))
        except Exception as e:
            print(f"[akshare] Realtime quote error for {symbol}: {e}")
            continue

    return quotes
