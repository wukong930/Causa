"""Per-symbol transaction cost model for realistic backtesting.

Includes:
- Exchange commission (per lot, round-trip)
- Slippage estimate (ticks × tick_size × multiplier)
- Returns a cost rate suitable for vectorbt fees parameter
"""

from dataclasses import dataclass


@dataclass
class CostSpec:
    commission: float      # 单边手续费（元/手）
    slippage_ticks: int    # 预估滑点（跳数）
    tick_size: float       # 最小变动价位
    multiplier: int        # 合约乘数（吨/手 或 克/手等）


# 全品种成本表（基于2024-2025交易所标准+经纪商加收）
COST_TABLE: dict[str, CostSpec] = {
    # ── 黑色系 (SHFE/DCE) ──
    "RB": CostSpec(commission=3.5, slippage_ticks=1, tick_size=1, multiplier=10),
    "HC": CostSpec(commission=3.5, slippage_ticks=1, tick_size=1, multiplier=10),
    "SS": CostSpec(commission=6.0, slippage_ticks=1, tick_size=5, multiplier=5),
    "I":  CostSpec(commission=4.0, slippage_ticks=1, tick_size=0.5, multiplier=100),
    "J":  CostSpec(commission=6.0, slippage_ticks=1, tick_size=0.5, multiplier=100),
    "JM": CostSpec(commission=4.0, slippage_ticks=1, tick_size=0.5, multiplier=60),
    "SF": CostSpec(commission=3.0, slippage_ticks=1, tick_size=2, multiplier=5),
    "SM": CostSpec(commission=3.0, slippage_ticks=1, tick_size=2, multiplier=5),
    # ── 有色金属 (SHFE) ──
    "CU": CostSpec(commission=12.0, slippage_ticks=1, tick_size=10, multiplier=5),
    "AL": CostSpec(commission=5.0, slippage_ticks=1, tick_size=5, multiplier=5),
    "ZN": CostSpec(commission=5.0, slippage_ticks=1, tick_size=5, multiplier=5),
    "NI": CostSpec(commission=6.0, slippage_ticks=1, tick_size=10, multiplier=1),
    "SN": CostSpec(commission=6.0, slippage_ticks=1, tick_size=10, multiplier=1),
    "PB": CostSpec(commission=4.0, slippage_ticks=1, tick_size=5, multiplier=5),
    "BC": CostSpec(commission=12.0, slippage_ticks=1, tick_size=10, multiplier=5),
    # ── 贵金属 (SHFE) ──
    "AU": CostSpec(commission=10.0, slippage_ticks=1, tick_size=0.02, multiplier=1000),
    "AG": CostSpec(commission=5.0, slippage_ticks=1, tick_size=1, multiplier=15),
    # ── 能化 (SHFE/INE/DCE/CZCE) ──
    "SC": CostSpec(commission=20.0, slippage_ticks=1, tick_size=0.1, multiplier=1000),
    "FU": CostSpec(commission=5.0, slippage_ticks=1, tick_size=1, multiplier=10),
    "LU": CostSpec(commission=5.0, slippage_ticks=1, tick_size=1, multiplier=10),
    "BU": CostSpec(commission=5.0, slippage_ticks=1, tick_size=1, multiplier=10),
    "PP": CostSpec(commission=4.0, slippage_ticks=1, tick_size=1, multiplier=5),
    "TA": CostSpec(commission=3.0, slippage_ticks=1, tick_size=2, multiplier=5),
    "MEG": CostSpec(commission=4.0, slippage_ticks=1, tick_size=1, multiplier=10),
    "MA": CostSpec(commission=3.0, slippage_ticks=1, tick_size=1, multiplier=10),
    "EB": CostSpec(commission=3.0, slippage_ticks=1, tick_size=1, multiplier=5),
    "PG": CostSpec(commission=6.0, slippage_ticks=1, tick_size=1, multiplier=20),
    "SA": CostSpec(commission=4.0, slippage_ticks=1, tick_size=1, multiplier=20),
    "UR": CostSpec(commission=5.0, slippage_ticks=1, tick_size=1, multiplier=20),
    "V":  CostSpec(commission=3.0, slippage_ticks=1, tick_size=5, multiplier=5),
    "L":  CostSpec(commission=3.0, slippage_ticks=1, tick_size=5, multiplier=5),
    # ── 农产品 (DCE/CZCE) ──
    "P":  CostSpec(commission=3.0, slippage_ticks=1, tick_size=2, multiplier=10),
    "Y":  CostSpec(commission=3.0, slippage_ticks=1, tick_size=2, multiplier=10),
    "M":  CostSpec(commission=3.0, slippage_ticks=1, tick_size=1, multiplier=10),
    "OI": CostSpec(commission=3.0, slippage_ticks=1, tick_size=1, multiplier=10),
    "RM": CostSpec(commission=3.0, slippage_ticks=1, tick_size=1, multiplier=10),
    "CF": CostSpec(commission=5.0, slippage_ticks=1, tick_size=5, multiplier=5),
    "SR": CostSpec(commission=3.0, slippage_ticks=1, tick_size=1, multiplier=10),
    "AP": CostSpec(commission=5.0, slippage_ticks=1, tick_size=1, multiplier=10),
    "C":  CostSpec(commission=2.5, slippage_ticks=1, tick_size=1, multiplier=10),
    "CS": CostSpec(commission=3.0, slippage_ticks=1, tick_size=1, multiplier=10),
    "A":  CostSpec(commission=3.0, slippage_ticks=1, tick_size=1, multiplier=10),
    "JD": CostSpec(commission=4.0, slippage_ticks=1, tick_size=1, multiplier=10),
    "LH": CostSpec(commission=8.0, slippage_ticks=1, tick_size=5, multiplier=16),
    "SP": CostSpec(commission=3.0, slippage_ticks=1, tick_size=2, multiplier=10),
    "PK": CostSpec(commission=4.0, slippage_ticks=1, tick_size=2, multiplier=5),
    # ── 贵金属 (GFEX) ──
    "PT": CostSpec(commission=8.0, slippage_ticks=1, tick_size=0.1, multiplier=1000),
    "PD": CostSpec(commission=8.0, slippage_ticks=1, tick_size=0.2, multiplier=500),
    # ── 外盘 (占位，不计国内手续费) ──
    "CL":  CostSpec(commission=0, slippage_ticks=0, tick_size=0.01, multiplier=1000),
    "OIL": CostSpec(commission=0, slippage_ticks=0, tick_size=0.01, multiplier=1000),
    "KC":  CostSpec(commission=0, slippage_ticks=0, tick_size=0.05, multiplier=37500),
    "RH":  CostSpec(commission=0, slippage_ticks=0, tick_size=1.0, multiplier=1),
}

# Default for unknown symbols
_DEFAULT_SPEC = CostSpec(commission=5.0, slippage_ticks=1, tick_size=1, multiplier=10)


def get_cost_spec(symbol: str) -> CostSpec:
    """Get cost specification for a symbol."""
    base = symbol.upper().rstrip("0123456789")
    return COST_TABLE.get(base, _DEFAULT_SPEC)


def get_cost_rate(symbol: str, price: float) -> float:
    """Calculate round-trip cost as a fraction of trade value.

    Used as the `fees` parameter in vectorbt (applied per trade).
    Includes commission + slippage for one side (vectorbt applies to both entry and exit).
    """
    spec = get_cost_spec(symbol)
    if price <= 0:
        return 0.001  # fallback 0.1%

    trade_value = price * spec.multiplier
    one_side_cost = spec.commission + spec.slippage_ticks * spec.tick_size * spec.multiplier
    # vectorbt applies fees on both entry and exit, so we give per-side rate
    return one_side_cost / trade_value


def get_total_cost_per_trade(symbol: str, price: float) -> float:
    """Calculate total round-trip cost in CNY per lot."""
    spec = get_cost_spec(symbol)
    slippage_cost = spec.slippage_ticks * spec.tick_size * spec.multiplier
    return (spec.commission + slippage_cost) * 2  # round-trip
