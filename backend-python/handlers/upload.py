from __future__ import annotations
import logging

from fastapi import APIRouter, File, Request, UploadFile
from fastapi.responses import JSONResponse

from models.api import ColumnStats, UploadResponse
from services.file_storage import file_storage
from utils.errors import ValidationError
from utils.response import error, success
from utils.validation import validate_upload

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/upload")
async def upload_file(request: Request, file: UploadFile = File(...)) -> JSONResponse:
    req_id = getattr(request.state, "request_id", None)
    try:
        content = await file.read()
        err = validate_upload(file.filename or "", len(content))
        if err:
            return error(err, "VALIDATION_ERROR", req_id, 400)

        file_id, dataset = file_storage.save_file(file.filename or "upload", content)

        # Serialize summary — ColumnStats are Pydantic models
        summary_out: dict = {}
        for col_name, stats in dataset.summary.items():
            summary_out[col_name] = stats.model_dump(by_alias=True)

        resp = UploadResponse(
            **{
                "fileId": file_id,
                "fileName": file.filename or "upload",
                "columns": dataset.columns,
                "summary": dataset.summary,
            }
        )
        return success(resp, 200)

    except ValidationError as exc:
        return error(exc.message, exc.code.value, req_id, exc.status_code)
    except Exception as exc:
        logger.exception("Upload failed")
        return error(str(exc), "INTERNAL_ERROR", req_id, 500)
