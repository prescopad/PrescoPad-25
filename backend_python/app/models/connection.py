from pydantic import BaseModel
from typing import Optional


class InviteRequest(BaseModel):
    # Accept both camelCase (frontend) and snake_case
    assistant_phone: Optional[str] = None
    assistantPhone: Optional[str] = None

    def get_phone(self) -> str:
        return self.assistant_phone or self.assistantPhone or ""


class JoinRequest(BaseModel):
    doctor_code: Optional[str] = None
    doctorCode: Optional[str] = None

    def get_code(self) -> str:
        return self.doctor_code or self.doctorCode or ""
