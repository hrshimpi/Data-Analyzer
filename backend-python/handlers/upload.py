from __future__ import annotations
import logging
import uuid

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.api import UploadResponse
from models.dataset import parse_file
from models.db import Dataset as DatasetRecord, User
from services import storage_service
from services.auth_service import get_current_user
from utils.errors import ValidationError
from utils.response import error, success
from utils.validation import validate_upload

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/upload")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    req_id = getattr(request.state, "request_id", None)
    try:
        content = await file.read()
        filename = file.filename or "upload"
        err = validate_upload(filename, len(content))
        if err:
            return error(err, "VALIDATION_ERROR", req_id, 400)

        # Parse + compute stats exactly as before — this part is unchanged,
        # only what happens with the result differs (persisted now, not
        # stashed in a process-wide dict).
        parsed = parse_file(filename, content)

        dataset_id = uuid.uuid4()

        s3_key = await storage_service.upload_file(str(current_user.id), str(dataset_id), filename, content)

        column_schema = {
            "columns": [c.model_dump(by_alias=True) for c in parsed.columns],
            "summary": {name: stats.model_dump(by_alias=True) for name, stats in parsed.summary.items()},
        }
        record = DatasetRecord(
            id=dataset_id,
            user_id=current_user.id,
            filename=filename,
            s3_bucket=storage_service.bucket_name(),
            s3_key=s3_key,
            row_count=len(parsed.rows),
            column_schema=column_schema,
        )
        db.add(record)
        await db.commit()

        resp = UploadResponse(
            **{
                "fileId": str(dataset_id),
                "fileName": filename,
                "columns": parsed.columns,
                "summary": parsed.summary,
            }
        )
        return success(resp, 200)

    except ValidationError as exc:
        return error(exc.message, exc.code.value, req_id, exc.status_code)
    except Exception as exc:
        logger.exception("Upload failed")
        return error(str(exc), "INTERNAL_ERROR", req_id, 500)
