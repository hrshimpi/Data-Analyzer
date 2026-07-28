from __future__ import annotations
import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.api import AnalyzeRequest
from services import analysis_engine, dataset_service
from utils.response import error, success
from utils.validation import validate_prompt

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/analyze")
async def analyze(request: Request, body: AnalyzeRequest, db: AsyncSession = Depends(get_db)) -> JSONResponse:
    req_id = getattr(request.state, "request_id", None)
    try:
        prompt_err = validate_prompt(body.prompt)
        if prompt_err:
            return error(prompt_err, "VALIDATION_ERROR", req_id, 400)

        record = await dataset_service.get_dataset_record(db, body.file_id)
        if record is None:
            return error("Dataset not found. Please re-upload your file.", "NOT_FOUND", req_id, 404)

        # Row-level data is needed here (chart generation samples actual
        # rows), so re-fetch the file from storage and re-parse it.
        dataset = await dataset_service.load_parsed_dataset(record)

        result = await analysis_engine.process_analysis(dataset, body.prompt)
        return success(result)

    except Exception as exc:
        logger.exception("Analysis failed")
        return error(str(exc), "INTERNAL_ERROR", req_id, 500)
