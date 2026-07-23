from __future__ import annotations
import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from models.api import AnalyzeRequest
from services.file_storage import file_storage
from services import analysis_engine
from utils.response import error, success
from utils.validation import validate_prompt

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/analyze")
async def analyze(request: Request, body: AnalyzeRequest) -> JSONResponse:
    req_id = getattr(request.state, "request_id", None)
    try:
        prompt_err = validate_prompt(body.prompt)
        if prompt_err:
            return error(prompt_err, "VALIDATION_ERROR", req_id, 400)

        dataset = file_storage.get_dataset(body.file_id)
        if dataset is None:
            return error("Dataset not found. Please re-upload your file.", "NOT_FOUND", req_id, 404)

        result = await analysis_engine.process_analysis(dataset, body.prompt)
        return success(result)

    except Exception as exc:
        logger.exception("Analysis failed")
        return error(str(exc), "INTERNAL_ERROR", req_id, 500)
