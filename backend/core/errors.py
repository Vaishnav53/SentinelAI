from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from typing import Any, Dict, Optional

class SentinelException(Exception):
    """Base exception class for all platform exceptions."""
    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_SERVER_ERROR",
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}

class DatabaseException(SentinelException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, code="DATABASE_ERROR", status_code=500, details=details)

class ExternalServiceException(SentinelException):
    def __init__(self, message: str, service_name: str, details: Optional[Dict[str, Any]] = None):
        merged_details = {"service": service_name}
        if details:
            merged_details.update(details)
        super().__init__(message, code=f"{service_name.upper()}_OFFLINE", status_code=502, details=merged_details)

class NotFoundException(SentinelException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, code="NOT_FOUND", status_code=404, details=details)

class ValidationException(SentinelException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, code="VALIDATION_ERROR", status_code=400, details=details)

def sentinel_exception_handler(request: Request, exc: SentinelException) -> JSONResponse:
    """Format custom SentinelExceptions into standardized JSON envelopes."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details
            }
        }
    )

def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Format default starlette/fastapi HTTPExceptions (like 404, 405) into standardized JSON envelopes."""
    code = "HTTP_ERROR"
    if exc.status_code == 404:
        code = "NOT_FOUND"
    elif exc.status_code == 405:
        code = "METHOD_NOT_ALLOWED"
        
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": code,
                "message": str(exc.detail),
                "details": {}
            }
        }
    )

def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Format default Pydantic validation errors into standardized JSON envelopes."""
    return JSONResponse(
        status_code=400,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": {"errors": exc.errors()}
            }
        }
    )

def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Fallback handler for unhandled python standard exceptions."""
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred on the server.",
                "details": {"type": exc.__class__.__name__}
            }
        }
    )
