from __future__ import annotations
import logging
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("uvicorn.access")


class LoggerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        req_id = getattr(request.state, "request_id", "-")
        logger.info(
            "%s %s %d %.2fms [%s]",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            req_id,
        )
        return response
