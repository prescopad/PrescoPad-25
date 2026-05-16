import random
import string
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_otp(otp: str) -> str:
    return pwd_context.hash(otp)


def verify_otp(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def generate_doctor_code(length: int = 6) -> str:
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=length))


def generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))
