from pydantic import BaseModel
from typing import Optional, List, Literal


class PatientRequest(BaseModel):
    name: str
    age: Optional[int] = None
    gender: Optional[Literal["male", "female", "other"]] = None
    weight: Optional[float] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    blood_group: Optional[str] = None
    bloodGroup: Optional[str] = None
    allergies: Optional[str] = None

    def normalized(self) -> dict:
        d = {k: v for k, v in {
            "name": self.name,
            "age": self.age,
            "gender": self.gender,
            "weight": self.weight,
            "phone": self.phone,
            "address": self.address,
            "blood_group": self.blood_group or self.bloodGroup,
            "allergies": self.allergies,
        }.items() if v is not None}
        return d


class QueueRequest(BaseModel):
    patient_id: Optional[str] = None
    patientId: Optional[str] = None
    notes: Optional[str] = None
    added_by: Optional[str] = None

    def get_patient_id(self) -> str:
        return self.patient_id or self.patientId or ""


class QueueStatusRequest(BaseModel):
    status: Literal["waiting", "in_progress", "completed", "cancelled"]


class MedicineItem(BaseModel):
    medicine_name: Optional[str] = None
    medicineName: Optional[str] = None
    type: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    timing: Optional[str] = None
    notes: Optional[str] = None

    def normalized(self) -> dict:
        return {
            "medicine_name": self.medicine_name or self.medicineName or "",
            "type": self.type,
            "dosage": self.dosage,
            "frequency": self.frequency,
            "duration": self.duration,
            "timing": self.timing,
            "notes": self.notes,
        }


class LabTestItem(BaseModel):
    test_name: Optional[str] = None
    testName: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None

    def normalized(self) -> dict:
        return {
            "test_name": self.test_name or self.testName or "",
            "category": self.category,
            "notes": self.notes,
        }


class PrescriptionRequest(BaseModel):
    patient_id: Optional[str] = None
    patientId: Optional[str] = None
    patient_name: Optional[str] = None
    patientName: Optional[str] = None
    patient_age: Optional[int] = None
    patientAge: Optional[int] = None
    patient_gender: Optional[str] = None
    patientGender: Optional[str] = None
    patient_phone: Optional[str] = None
    patientPhone: Optional[str] = None
    doctor_id: Optional[str] = None
    diagnosis: Optional[str] = None
    advice: Optional[str] = None
    follow_up_date: Optional[str] = None
    followUpDate: Optional[str] = None
    symptoms: Optional[List[str]] = []
    medicines: Optional[List[MedicineItem]] = []
    lab_tests: Optional[List[LabTestItem]] = []
    labTests: Optional[List[LabTestItem]] = []

    def normalized(self) -> dict:
        meds = self.medicines or []
        tests = self.lab_tests or self.labTests or []
        return {
            "patient_id": self.patient_id or self.patientId,
            "patient_name": self.patient_name or self.patientName,
            "patient_age": self.patient_age or self.patientAge,
            "patient_gender": self.patient_gender or self.patientGender,
            "patient_phone": self.patient_phone or self.patientPhone,
            "diagnosis": self.diagnosis,
            "advice": self.advice,
            "follow_up_date": self.follow_up_date or self.followUpDate,
            "symptoms": self.symptoms or [],
            "medicines": [m.normalized() for m in meds],
            "lab_tests": [t.normalized() for t in tests],
        }


class CustomMedicineRequest(BaseModel):
    name: str
    type: Optional[str] = None
    strength: Optional[str] = None
    manufacturer: Optional[str] = None


class CustomMedicineUsageRequest(BaseModel):
    # Frontend sends {name} for usage tracking (by name not id)
    medicine_id: Optional[str] = None
    name: Optional[str] = None


class CustomLabTestRequest(BaseModel):
    name: str
    category: Optional[str] = None


class CustomLabTestUsageRequest(BaseModel):
    test_id: Optional[str] = None
    name: Optional[str] = None


class FinalizePrescriptionRequest(BaseModel):
    signature: Optional[str] = None
    pdf_hash: Optional[str] = None
    pdfHash: Optional[str] = None

