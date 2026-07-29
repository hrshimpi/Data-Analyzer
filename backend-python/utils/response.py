from __future__ import annotations
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Any


def success(data: BaseModel | dict[str, Any], status_code: int = 200) -> JSONResponse:
    if isinstance(data, BaseModel):
        # mode="json" converts non-JSON-native types (datetime, UUID, ...)
        # to their JSON-safe representation. Plain model_dump() leaves them
        # as Python objects, which JSONResponse's encoder can't serialize —
        # latent until ThreadSummary/MessageOut, the first response models
        # with a datetime field.
        body = data.model_dump(mode="json", by_alias=True)
    else:
        body = data
    return JSONResponse(content=body, status_code=status_code)


def error(message: str, code: str, request_id: str | None = None, status_code: int = 400) -> JSONResponse:
    body: dict[str, Any] = {"error": message, "code": code}
    if request_id:
        body["requestId"] = request_id
    return JSONResponse(content=body, status_code=status_code)
