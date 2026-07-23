from __future__ import annotations
import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from models.api import SuggestionsRequest, SuggestionsResponse
from services.file_storage import file_storage
from services import gemini
from utils.response import error, success

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/suggestions")
async def get_suggestions(request: Request, body: SuggestionsRequest) -> JSONResponse:
    req_id = getattr(request.state, "request_id", None)
    try:
        dataset = file_storage.get_dataset(body.file_id)
        if dataset is None:
            return error("Dataset not found. Please re-upload your file.", "NOT_FOUND", req_id, 404)

        suggestions = await gemini.get_suggestions(dataset.columns, dataset.summary)
        return success(SuggestionsResponse(suggestions=suggestions))

    except Exception as exc:
        logger.exception("Suggestions failed")
        return error(str(exc), "INTERNAL_ERROR", req_id, 500)
