from __future__ import annotations
import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.api import AnalyzeRequest
from models.db import MessageRole, User
from services import analysis_engine, dataset_service, thread_service
from services.auth_service import get_current_user
from utils.response import error, success
from utils.validation import validate_prompt

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/analyze")
async def analyze(
    request: Request,
    body: AnalyzeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    req_id = getattr(request.state, "request_id", None)
    try:
        prompt_err = validate_prompt(body.prompt)
        if prompt_err:
            return error(prompt_err, "VALIDATION_ERROR", req_id, 400)

        record = await dataset_service.get_dataset_record(db, body.file_id, current_user.id)
        if record is None:
            return error("Dataset not found. Please re-upload your file.", "NOT_FOUND", req_id, 404)

        if body.thread_id:
            thread = await thread_service.get_thread(db, body.thread_id, current_user.id)
            if thread is None:
                return error("Thread not found. Please start a new chat.", "NOT_FOUND", req_id, 404)
        else:
            thread = await thread_service.create_thread(db, current_user.id, record.id, title=record.filename)

        # Record the question before running the (slower, more failure-prone)
        # AI call, so it's never lost even if analysis fails downstream —
        # committed separately from the assistant's reply below.
        await thread_service.append_message(db, thread, MessageRole.USER, body.prompt)
        await db.commit()

        # Row-level data is needed here (chart generation samples actual
        # rows), so re-fetch the file from storage and re-parse it.
        dataset = await dataset_service.load_parsed_dataset(record)
        result = await analysis_engine.process_analysis(dataset, body.prompt)

        chart_configs = {
            "charts": [c.model_dump(by_alias=True) for c in result.charts],
            "chartStatus": result.chart_status,
            "chartMessage": result.chart_message,
            "retryAttempts": result.retry_attempts,
        }
        await thread_service.append_message(db, thread, MessageRole.ASSISTANT, result.insights, chart_configs)
        await db.commit()

        return success(result.model_copy(update={"thread_id": str(thread.id), "title": thread.title}))

    except Exception as exc:
        logger.exception("Analysis failed")
        return error(str(exc), "INTERNAL_ERROR", req_id, 500)
