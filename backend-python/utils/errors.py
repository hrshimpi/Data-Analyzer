from __future__ import annotations
from enum import Enum


class ErrorCode(str, Enum):
    VALIDATION_ERROR = "VALIDATION_ERROR"
    NOT_FOUND = "NOT_FOUND"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    EXTERNAL_ERROR = "EXTERNAL_ERROR"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    UNSUPPORTED_FILE_TYPE = "UNSUPPORTED_FILE_TYPE"


class AppError(Exception):
    def __init__(self, message: str, code: ErrorCode, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


class ValidationError(AppError):
    def __init__(self, message: str):
        super().__init__(message, ErrorCode.VALIDATION_ERROR, 400)


class NotFoundError(AppError):
    def __init__(self, message: str):
        super().__init__(message, ErrorCode.NOT_FOUND, 404)


class InternalError(AppError):
    def __init__(self, message: str):
        super().__init__(message, ErrorCode.INTERNAL_ERROR, 500)


class ExternalError(AppError):
    def __init__(self, message: str):
        super().__init__(message, ErrorCode.EXTERNAL_ERROR, 502)
