"""Risk constraints for backtesting — position limits, drawdown limits, daily loss limits."""

from pydantic import BaseModel
from typing import Optional


class RiskConstraints(BaseModel):
    max_position_size: float = 100.0  # max lots
    max_drawdown_limit: float = 0.15  # 15% max drawdown triggers stop
    daily_loss_limit: float = 0.03  # 3% daily loss triggers stop
    max_holding_days: int = 30  # force close after N days
    max_correlated_positions: int = 3  # max positions in same category


class RiskCheckResult(BaseModel):
    passed: bool
    violations: list[str]


def check_position_risk(
    current_drawdown: float,
    daily_pnl_pct: float,
    position_size: float,
    holding_days: int,
    constraints: Optional[RiskConstraints] = None,
) -> RiskCheckResult:
    """Check if current position violates any risk constraints."""
    c = constraints or RiskConstraints()
    violations: list[str] = []

    if abs(current_drawdown) > c.max_drawdown_limit:
        violations.append(f"回撤 {abs(current_drawdown)*100:.1f}% 超过限制 {c.max_drawdown_limit*100:.0f}%")

    if daily_pnl_pct < -c.daily_loss_limit:
        violations.append(f"日亏损 {abs(daily_pnl_pct)*100:.1f}% 超过限制 {c.daily_loss_limit*100:.0f}%")

    if position_size > c.max_position_size:
        violations.append(f"持仓 {position_size} 手超过限制 {c.max_position_size} 手")

    if holding_days > c.max_holding_days:
        violations.append(f"持仓 {holding_days} 天超过限制 {c.max_holding_days} 天")

    return RiskCheckResult(passed=len(violations) == 0, violations=violations)
