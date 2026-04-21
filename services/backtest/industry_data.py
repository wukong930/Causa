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
        "RB": "螺纹钢", "HC": "热卷", "SS": "不锈钢", "I": "铁矿石", "J": "焦炭", "JM": "焦煤",
        "SF": "硅铁", "SM": "锰硅",
        "CU": "沪铜", "AL": "沪铝", "ZN": "沪锌", "NI": "镍", "SN": "沪锡", "PB": "沪铅",
        "AG": "沪银", "AU": "沪金", "BC": "国际铜",
        "SC": "原油", "FU": "燃料油", "LU": "低硫燃油", "BU": "沥青",
        "PP": "聚丙烯", "TA": "PTA", "MEG": "乙二醇", "MA": "甲醇",
        "EB": "苯乙烯", "PG": "液化气", "SA": "纯碱", "UR": "尿素", "V": "PVC", "L": "塑料",
        "P": "棕榈", "Y": "豆油", "M": "豆粕", "OI": "菜油", "RM": "菜粕",
        "CF": "郑棉", "SR": "白糖", "AP": "苹果", "C": "玉米", "CS": "淀粉",
        "A": "豆一", "JD": "鸡蛋", "LH": "生猪", "SP": "纸浆", "PK": "花生",
        "SI": "工业硅", "LC": "碳酸锂",
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
        today = datetime.now().strftime("%Y%m%d")
        df = ak.futures_spot_price_daily(start_day=today, end_day=today, vars_list=[sym])
        if df is None or df.empty:
            return []

        points: list[IndustryDataPoint] = []
        for _, row in df.iterrows():
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
        "RB": "螺纹钢", "HC": "热卷", "SS": "不锈钢", "I": "铁矿石", "J": "焦炭", "JM": "焦煤",
        "SF": "硅铁", "SM": "锰硅",
        "CU": "铜", "AL": "铝", "ZN": "锌", "NI": "镍", "SN": "锡", "PB": "铅",
        "SC": "原油", "FU": "燃料油", "BU": "沥青",
        "PP": "聚丙烯", "TA": "PTA", "MEG": "乙二醇", "MA": "甲醇",
        "EB": "苯乙烯", "PG": "液化气", "SA": "纯碱", "UR": "尿素", "V": "PVC", "L": "塑料",
        "P": "棕榈油", "Y": "豆油", "M": "豆粕", "OI": "菜油", "RM": "菜粕",
        "CF": "棉花", "SR": "白糖", "AP": "苹果", "C": "玉米", "CS": "淀粉",
        "A": "豆一", "JD": "鸡蛋", "LH": "生猪", "SP": "纸浆", "PK": "花生",
        "AU": "黄金", "AG": "白银", "PT": "铂", "PD": "钯",
        "SI": "工业硅", "LC": "碳酸锂",
    }


# ─── New data sources ────────────────────────────────────────────────────────


def fetch_position_rank(symbol: str, limit: int = 1) -> list[IndustryDataPoint]:
    """Fetch top trader position rankings (龙虎榜) — net long/short of top 20."""
    sym = symbol.upper()
    try:
        today = datetime.now().strftime("%Y%m%d")
        result = ak.futures_dce_position_rank(date=today, vars_list=[sym])
        if not result or sym not in result:
            return []
        df = result[sym]
        if df is None or df.empty:
            return []

        # Sum top 20 long and short positions
        long_total = float(df["多头持仓量"].sum()) if "多头持仓量" in df.columns else 0
        short_total = float(df["空头持仓量"].sum()) if "空头持仓量" in df.columns else 0
        net = long_total - short_total
        today_str = datetime.now().strftime("%Y-%m-%d")

        return [
            IndustryDataPoint(symbol=sym, data_type="position_rank_long", value=long_total, unit="手", date=today_str, source="exchange_rank"),
            IndustryDataPoint(symbol=sym, data_type="position_rank_short", value=short_total, unit="手", date=today_str, source="exchange_rank"),
            IndustryDataPoint(symbol=sym, data_type="position_rank_net", value=net, unit="手", date=today_str, source="exchange_rank"),
        ]
    except Exception as e:
        print(f"[industry] Position rank fetch failed for {symbol}: {e}")
        return []


def fetch_volatility_index() -> list[IndustryDataPoint]:
    """Fetch 50ETF volatility index (iVX/QVIX)."""
    try:
        df = ak.index_option_50etf_qvix()
        if df is None or df.empty:
            return []
        latest = df.iloc[-1]
        date_val = str(latest.get("日期", latest.get("date", datetime.now().strftime("%Y-%m-%d"))))
        value = float(latest.get("qvix", latest.get("收盘", 0)))
        if value > 0:
            return [IndustryDataPoint(
                symbol="IVX", data_type="volatility_index", value=value,
                unit="点", date=date_val, source="sse_qvix",
            )]
        return []
    except Exception as e:
        print(f"[industry] Volatility index fetch failed: {e}")
        return []


def fetch_fund_flow() -> list[IndustryDataPoint]:
    """Fetch northbound/southbound fund flow (沪深港通)."""
    try:
        df = ak.stock_hsgt_fund_flow_summary_em()
        if df is None or df.empty:
            return []
        latest = df.iloc[-1]
        date_val = str(latest.get("日期", latest.get("date", datetime.now().strftime("%Y-%m-%d"))))
        points: list[IndustryDataPoint] = []

        north = float(latest.get("北向资金", latest.get("沪股通净流入", 0)))
        south = float(latest.get("南向资金", latest.get("港股通净流入", 0)))
        if north != 0:
            points.append(IndustryDataPoint(
                symbol="HSGT", data_type="fund_flow_north", value=north,
                unit="亿元", date=date_val, source="eastmoney",
            ))
        if south != 0:
            points.append(IndustryDataPoint(
                symbol="HSGT", data_type="fund_flow_south", value=south,
                unit="亿元", date=date_val, source="eastmoney",
            ))
        return points
    except Exception as e:
        print(f"[industry] Fund flow fetch failed: {e}")
        return []


# Weather monitoring regions for agricultural commodities
WEATHER_REGIONS: dict[str, tuple[str, float, float]] = {
    "M": ("哈尔滨", 45.75, 126.65),   # 大豆 — 黑龙江
    "C": ("长春", 43.88, 125.32),      # 玉米 — 吉林
    "CF": ("乌鲁木齐", 43.82, 87.62),  # 棉花 — 新疆
    "SR": ("南宁", 22.82, 108.37),     # 白糖 — 广西
    "AP": ("烟台", 37.46, 121.45),     # 苹果 — 山东
}


def fetch_weather(symbol: str, api_key: str = "") -> list[IndustryDataPoint]:
    """Fetch weather data for agricultural commodity production regions."""
    sym = symbol.upper()
    region = WEATHER_REGIONS.get(sym)
    if not region or not api_key:
        return []

    name, lat, lon = region
    try:
        import httpx
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&units=metric"
        resp = httpx.get(url, timeout=10)
        if resp.status_code != 200:
            return []
        data = resp.json()
        today_str = datetime.now().strftime("%Y-%m-%d")
        points: list[IndustryDataPoint] = []

        temp = data.get("main", {}).get("temp")
        if temp is not None:
            points.append(IndustryDataPoint(
                symbol=sym, data_type="weather_temp", value=float(temp),
                unit="°C", date=today_str, source=f"openweathermap_{name}",
            ))

        rain = data.get("rain", {}).get("1h", 0) or data.get("rain", {}).get("3h", 0)
        points.append(IndustryDataPoint(
            symbol=sym, data_type="weather_precip", value=float(rain),
            unit="mm", date=today_str, source=f"openweathermap_{name}",
        ))
        return points
    except Exception as e:
        print(f"[industry] Weather fetch failed for {symbol} ({name}): {e}")
        return []
