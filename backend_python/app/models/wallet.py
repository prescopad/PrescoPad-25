from pydantic import BaseModel
from typing import Optional


class RechargeRequest(BaseModel):
    amount: float
    reference_id: Optional[str] = None
    referenceId: Optional[str] = None

    def get_reference_id(self) -> Optional[str]:
        return self.reference_id or self.referenceId


class DeductRequest(BaseModel):
    amount: float
    description: str
    reference_id: Optional[str] = None
    referenceId: Optional[str] = None

    def get_reference_id(self) -> Optional[str]:
        return self.reference_id or self.referenceId


class AutoRefillRequest(BaseModel):
    # Accept both camelCase and snake_case
    auto_refill: Optional[bool] = None
    autoRefill: Optional[bool] = None
    auto_refill_amount: Optional[float] = None
    autoRefillAmount: Optional[float] = None
    auto_refill_threshold: Optional[float] = None
    autoRefillThreshold: Optional[float] = None

    def get_auto_refill(self) -> bool:
        v = self.auto_refill if self.auto_refill is not None else self.autoRefill
        return v if v is not None else False

    def get_amount(self) -> Optional[float]:
        return self.auto_refill_amount if self.auto_refill_amount is not None else self.autoRefillAmount

    def get_threshold(self) -> Optional[float]:
        return self.auto_refill_threshold if self.auto_refill_threshold is not None else self.autoRefillThreshold
