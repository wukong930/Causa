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
        # AkShare returns English columns: date, open, high, low, close
        date_val = str(latest.get("date", latest.get("日期", datetime.now().strftime("%Y-%m-%d"))))
        value = float(latest.get("close", latest.get("qvix", latest.get("收盘", 0))))
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

        # AkShare returns multi-row data with columns:
        # 交易日, 类型, 板块, 资金方向, 交易状态, 成交净买额, 资金净流入, ...
        # Filter latest date, group by 资金方向 (北向/南向), sum 成交净买额
        latest_date = df["交易日"].max()
        today_df = df[df["交易日"] == latest_date]
        date_val = str(latest_date)
        points: list[IndustryDataPoint] = []

        north_rows = today_df[today_df["资金方向"] == "北向"]
        south_rows = today_df[today_df["资金方向"] == "南向"]

        north = float(north_rows["成交净买额"].sum()) if not north_rows.empty else 0
        south = float(south_rows["成交净买额"].sum()) if not south_rows.empty else 0

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


# ─── Phase 2 data sources ───────────────────────────────────────────────────


def fetch_fx_rate() -> list[IndustryDataPoint]:
    """Fetch USD/CNY spot exchange rate."""
    try:
        df = ak.fx_spot_quote()
        if df is None or df.empty:
            return []
        row = df[df["货币对"] == "USD/CNY"]
        if row.empty:
            return []
        mid = (float(row.iloc[0]["买报价"]) + float(row.iloc[0]["卖报价"])) / 2
        return [IndustryDataPoint(
            symbol="USDCNY", data_type="fx_usdcny", value=mid,
            unit="CNY", date=datetime.now().strftime("%Y-%m-%d"), source="fx_spot",
        )]
    except Exception as e:
        print(f"[industry] FX rate fetch failed: {e}")
        return []


def fetch_shipping_bdi() -> list[IndustryDataPoint]:
    """Fetch Baltic Dry Index (BDI)."""
    try:
        df = ak.macro_shipping_bdi()
        if df is None or df.empty:
            return []
        latest = df.iloc[-1]
        return [IndustryDataPoint(
            symbol="BDI", data_type="shipping_bdi", value=float(latest["最新值"]),
            unit="点", date=str(latest["日期"]), source="baltic_exchange",
        )]
    except Exception as e:
        print(f"[industry] BDI fetch failed: {e}")
        return []


def fetch_macro_pmi() -> list[IndustryDataPoint]:
    """Fetch China manufacturing PMI."""
    try:
        df = ak.macro_china_pmi_yearly()
        if df is None or df.empty:
            return []
        # Filter for manufacturing PMI only
        pmi = df[df["商品"] == "中国官方制造业PMI"]
        if pmi.empty:
            return []
        latest = pmi.iloc[-1]
        return [IndustryDataPoint(
            symbol="PMI", data_type="macro_pmi", value=float(latest["今值"]),
            unit="点", date=str(latest["日期"]), source="stats_gov",
        )]
    except Exception as e:
        print(f"[industry] PMI fetch failed: {e}")
        return []


# CFTC commodity → our symbol mapping
_CFTC_MAP = {
    "纽约原油": "CL", "原糖": "SB", "大豆": "S", "豆油": "Y",
    "豆粕": "M", "白银": "AG", "铂金": "PT", "钯金": "PD",
    "纽约天然气": "NG", "黄金": "AU", "棉花": "CF", "玉米": "C",
}


def fetch_cftc_holding() -> list[IndustryDataPoint]:
    """Fetch CFTC Commitments of Traders — net positions for key commodities."""
    try:
        df = ak.macro_usa_cftc_c_holding()
        if df is None or df.empty:
            return []
        latest = df.iloc[-1]
        date_val = str(latest["日期"])
        points: list[IndustryDataPoint] = []
        for cn_name, sym in _CFTC_MAP.items():
            net_col = f"{cn_name}-净仓位"
            if net_col in latest.index:
                val = float(latest[net_col])
                points.append(IndustryDataPoint(
                    symbol=sym, data_type="cftc_net", value=val,
                    unit="手", date=date_val, source="cftc",
                ))
        return points
    except Exception as e:
        print(f"[industry] CFTC fetch failed: {e}")
        return []


# Exchange → rank function mapping
_EXCHANGE_SYMBOLS = {
    "SHFE": ["CU", "AL", "ZN", "NI", "SN", "PB", "AU", "AG", "RB", "HC", "SS", "BU", "FU", "SP", "SC", "BC", "LU"],
    "CZCE": ["TA", "MA", "CF", "SR", "OI", "RM", "SA", "UR", "AP", "PK", "SF", "SM"],
    "GFEX": ["SI", "LC"],
}


def fetch_position_rank_multi(symbol: str, limit: int = 1) -> list[IndustryDataPoint]:
    """Fetch position rank from the correct exchange (SHFE/CZCE/GFEX), falling back to DCE."""
    sym = symbol.upper()
    today = datetime.now().strftime("%Y%m%d")
    today_str = datetime.now().strftime("%Y-%m-%d")

    try:
        df_dict = None
        # Determine exchange
        if sym in _EXCHANGE_SYMBOLS.get("SHFE", []):
            df_dict = ak.get_shfe_rank_table(date=today)
        elif sym in _EXCHANGE_SYMBOLS.get("CZCE", []):
            df_dict = ak.get_rank_table_czce(date=today)
        elif sym in _EXCHANGE_SYMBOLS.get("GFEX", []):
            df_dict = ak.futures_gfex_position_rank(date=today)
        else:
            # DCE fallback
            result = ak.futures_dce_position_rank(date=today, vars_list=[sym])
            if result and sym in result:
                df_dict = {sym: result[sym]}

        if not df_dict:
            return []

        # Find the main contract for this symbol (highest volume)
        target_keys = [k for k in df_dict.keys() if k.upper().startswith(sym.lower()) or k.upper().startswith(sym)]
        if not target_keys:
            return []

        # Merge all contracts for this symbol
        frames = [df_dict[k] for k in target_keys if df_dict[k] is not None and not df_dict[k].empty]
        if not frames:
            return []

        import pandas as pd
        merged = pd.concat(frames, ignore_index=True)

        long_total = float(merged["long_open_interest"].sum()) if "long_open_interest" in merged.columns else 0
        short_total = float(merged["short_open_interest"].sum()) if "short_open_interest" in merged.columns else 0
        net = long_total - short_total

        return [
            IndustryDataPoint(symbol=sym, data_type="position_rank_long", value=long_total, unit="手", date=today_str, source="exchange_rank"),
            IndustryDataPoint(symbol=sym, data_type="position_rank_short", value=short_total, unit="手", date=today_str, source="exchange_rank"),
            IndustryDataPoint(symbol=sym, data_type="position_rank_net", value=net, unit="手", date=today_str, source="exchange_rank"),
        ]
    except Exception as e:
        print(f"[industry] Position rank (multi) fetch failed for {symbol}: {e}")
        return []
