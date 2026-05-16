from fastapi.responses import JSONResponse
from typing import Any, Optional


def success(data: Any = None, message: str = "Success", status_code: int = 200):
    body = {"success": True, "message": message}
    if data is not None:
        body["data"] = data
    return JSONResponse(content=body, status_code=status_code)


def error(message: str, status_code: int = 400, details: Any = None):
    body = {"success": False, "message": message}
    if details is not None:
        body["details"] = details
    return JSONResponse(content=body, status_code=status_code)
