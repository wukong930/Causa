"""Industry data ingestion from AkShare — inventory, spot prices, basis."""

import akshare as ak
import pandas as pd
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class IndustryDataPoint(BaseModel):
    symbol: str
    data_type: str  # inventory | spot_price | basis
    value: float
    unit: str
    date: str
    source: str


def _inventory_name_map() -> dict[str, str]:
    """Map futures symbols to AkShare inventory names (Chinese)."""
    return {
        "RB": "螺纹钢", "HC": "热卷", "I": "铁矿石", "J": "焦炭", "JM": "焦煤",
        "CU": "沪铜", "AL": "沪铝", "ZN": "沪锌", "NI": "镍", "AG": "沪银", "AU": "沪金",
        "SC": "原油", "PP": "聚丙烯", "TA": "PTA", "MA": "甲醇", "FG": "玻璃",
        "P": "棕榈", "Y": "豆油", "M": "豆粕", "CF": "郑棉", "SA": "纯碱",
    }


def fetch_inventory(symbol: str, limit: int = 60) -> list[IndustryDataPoint]:
    """Fetch exchange warehouse receipts / inventory data."""
    sym = symbol.upper()
    name_map = _inventory_name_map()
    cn_name = name_map.get(sym)
    if not cn_name:
        return []
    try:
        df = ak.futures_inventory_em(symbol=cn_name)
        if df is None or df.empty:
            return []

        df = df.tail(limit).reset_index(drop=True)
        points: list[IndustryDataPoint] = []
        for _, row in df.iterrows():
            date_val = str(row.get("日期", row.get("date", "")))
            value = float(row.get("库存", row.get("inventory", row.get("仓单数量", 0))))
            if value > 0:
                points.append(IndustryDataPoint(
                    symbol=sym, data_type="inventory", value=value,
                    unit="吨", date=date_val, source="exchange_warehouse",
                ))
        return points
    except Exception as e:
        print(f"[industry] Inventory fetch failed for {symbol}: {e}")
        return []


def fetch_spot_price(symbol: str, limit: int = 60) -> list[IndustryDataPoint]:
    """Fetch spot (cash) prices for basis calculation."""
    sym = symbol.upper()
    try:
        df = ak.futures_spot_price_daily(date=datetime.now().strftime("%Y%m%d"))
        if df is None or df.empty:
            return []

        # Filter for matching symbol
        name_map = _spot_symbol_map()
        spot_name = name_map.get(sym)
        if not spot_name:
            return []

        matched = df[df.iloc[:, 0].str.contains(spot_name, na=False)]
        if matched.empty:
            return []

        points: list[IndustryDataPoint] = []
        for _, row in matched.iterrows():
            price = float(row.iloc[1]) if len(row) > 1 else 0
            if price > 0:
                points.append(IndustryDataPoint(
                    symbol=sym, data_type="spot_price", value=price,
                    unit="元/吨", date=datetime.now().strftime("%Y-%m-%d"),
                    source="spot_market",
                ))
        return points
    except Exception as e:
        print(f"[industry] Spot price fetch failed for {symbol}: {e}")
        return []


def fetch_basis(symbol: str, futures_price: Optional[float] = None) -> Optional[IndustryDataPoint]:
    """Calculate basis = spot - futures for a symbol."""
    spots = fetch_spot_price(symbol, limit=1)
    if not spots:
        return None

    spot_price = spots[0].value
    if futures_price is None:
        from akshare_ingest import fetch_futures_daily
        bars = fetch_futures_daily(symbol, days=1)
        if not bars:
            return None
        futures_price = bars[-1].close

    basis = spot_price - futures_price
    return IndustryDataPoint(
        symbol=symbol.upper(), data_type="basis", value=basis,
        unit="元/吨", date=datetime.now().strftime("%Y-%m-%d"),
        source="calculated",
    )


def _spot_symbol_map() -> dict[str, str]:
    """Map futures symbols to spot market search terms."""
    return {
        "RB": "螺纹钢", "HC": "热卷", "I": "铁矿石", "J": "焦炭", "JM": "焦煤",
        "CU": "铜", "AL": "铝", "ZN": "锌", "NI": "镍",
        "SC": "原油", "PP": "聚丙烯", "TA": "PTA", "MEG": "乙二醇", "MA": "甲醇",
        "P": "棕榈油", "Y": "豆油", "M": "豆粕", "CF": "棉花",
        "AU": "黄金", "AG": "白银",
    }
