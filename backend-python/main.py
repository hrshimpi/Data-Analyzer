from __future__ import annotations
import logging
import os
import traceback

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from handlers.upload import router as upload_router
from handlers.suggestions import router as suggestions_router
from handlers.contextual_suggestions import router as contextual_suggestions_router
from handlers.analyze import router as analyze_router
from handlers.threads import router as threads_router
from middleware.logger import LoggerMiddleware
from middleware.request_id import RequestIDMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)

app = FastAPI(title="Agentic Data Analyzer API (Python)", version="1.0.0")

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
_raw_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:5173")
_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Custom middleware (order matters — last added = outermost)
# ---------------------------------------------------------------------------
app.add_middleware(LoggerMiddleware)
app.add_middleware(RequestIDMiddleware)

# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    req_id = getattr(request.state, "request_id", None)
    logging.getLogger(__name__).error("Unhandled exception: %s\n%s", exc, traceback.format_exc())
    body = {"error": "Internal server error", "code": "INTERNAL_ERROR"}
    if req_id:
        body["requestId"] = req_id
    return JSONResponse(content=body, status_code=500)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
app.include_router(upload_router)
app.include_router(suggestions_router)
app.include_router(contextual_suggestions_router)
app.include_router(analyze_router)
app.include_router(threads_router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "agentic-data-analyzer-python"}


# ---------------------------------------------------------------------------
# Dev entrypoint
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 3001))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
