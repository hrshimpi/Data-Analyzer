from __future__ import annotations
import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.api import SuggestionsRequest, SuggestionsResponse
from models.db import User
from services import dataset_service, gemini
from services.auth_service import get_current_user
from utils.response import error, success

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/suggestions")
async def get_suggestions(
    request: Request,
    body: SuggestionsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    req_id = getattr(request.state, "request_id", None)
    try:
        record = await dataset_service.get_dataset_record(db, body.file_id, current_user.id)
        if record is None:
            return error("Dataset not found. Please re-upload your file.", "NOT_FOUND", req_id, 404)

        # Schema-only — no need to re-fetch the file from storage here.
        columns, summary = dataset_service.schema_from_record(record)
        suggestions = await gemini.get_suggestions(columns, summary)
        return success(SuggestionsResponse(suggestions=suggestions))

    except Exception as exc:
        logger.exception("Suggestions failed")
        return error(str(exc), "INTERNAL_ERROR", req_id, 500)
