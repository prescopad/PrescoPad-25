from pydantic import BaseModel, Field, model_validator
from typing import Optional, Literal
from datetime import datetime


class SendOtpRequest(BaseModel):
    phone: str
    role: Literal["doctor", "assistant", "admin"]


class VerifyOtpRequest(BaseModel):
    phone: str
    otp: str
    role: Literal["doctor", "assistant", "admin"]


class LoginRequest(BaseModel):
    phone: str
    password: str
    role: Literal["doctor", "assistant", "admin"]


class RefreshTokenRequest(BaseModel):
    # Accept both camelCase (frontend) and snake_case
    refresh_token: Optional[str] = None
    refreshToken: Optional[str] = None

    @property
    def token(self) -> str:
        return self.refresh_token or self.refreshToken or ""


class CompleteRegistrationRequest(BaseModel):
    # Accept both camelCase and snake_case field names
    name: str
    specialty: Optional[str] = None
    reg_number: Optional[str] = None
    regNumber: Optional[str] = None
    password: Optional[str] = None
    qualification: Optional[str] = None
    experience_years: Optional[int] = None
    experienceYears: Optional[int] = None
    address: Optional[str] = None
    city: Optional[str] = None
    clinic_name: Optional[str] = None
    clinicName: Optional[str] = None
    selected_clinic_id: Optional[str] = None
    selectedClinicId: Optional[str] = None

    def normalized(self) -> dict:
        return {
            "name": self.name,
            "specialty": self.specialty,
            "reg_number": self.reg_number or self.regNumber,
            "password": self.password,
            "qualification": self.qualification,
            "experience_years": self.experience_years or self.experienceYears,
            "address": self.address,
            "city": self.city,
        }


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    specialty: Optional[str] = None
    reg_number: Optional[str] = None
    regNumber: Optional[str] = None
    qualification: Optional[str] = None
    experience_years: Optional[int] = None
    experienceYears: Optional[int] = None
    address: Optional[str] = None
    city: Optional[str] = None

    def normalized(self) -> dict:
        d = {}
        if self.name is not None:
            d["name"] = self.name
        if self.specialty is not None:
            d["specialty"] = self.specialty
        rn = self.reg_number or self.regNumber
        if rn is not None:
            d["reg_number"] = rn
        if self.qualification is not None:
            d["qualification"] = self.qualification
        ey = self.experience_years or self.experienceYears
        if ey is not None:
            d["experience_years"] = ey
        if self.address is not None:
            d["address"] = self.address
        if self.city is not None:
            d["city"] = self.city
        return d
