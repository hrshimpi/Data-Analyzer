from __future__ import annotations
import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.api import (
    CreateThreadRequest,
    MessageOut,
    RenameThreadRequest,
    ThreadDetailResponse,
    ThreadListResponse,
    ThreadSummary,
)
from models.db import User
from services import dataset_service, thread_service
from services.auth_service import get_current_user
from utils.response import error, success

logger = logging.getLogger(__name__)
router = APIRouter()


def _not_found(req_id: str | None) -> JSONResponse:
    return error("Thread not found.", "NOT_FOUND", req_id, 404)


async def _thread_detail_response(db: AsyncSession, thread, current_user: User) -> ThreadDetailResponse | None:
    """Shared by GET /threads/{id}/messages and POST /threads — both
    return "everything needed to render this thread" in one call: the
    dataset's schema (so the frontend doesn't need a second round trip)
    plus whatever messages exist so far."""
    record = await dataset_service.get_dataset_record(db, str(thread.dataset_id), current_user.id)
    if record is None:
        return None
    columns, summary = dataset_service.schema_from_record(record)
    messages = await thread_service.get_messages(db, thread.id)
    return ThreadDetailResponse(
        **{
            "threadId": str(thread.id),
            "title": thread.title,
            "datasetId": str(thread.dataset_id),
            "fileName": record.filename,
            "columns": columns,
            "summary": summary,
            "messages": [
                MessageOut(
                    **{
                        "id": str(m.id),
                        "role": m.role.value,
                        "content": m.content,
                        "chartConfigs": m.chart_configs,
                        "createdAt": m.created_at,
                    }
                )
                for m in messages
            ],
        }
    )


@router.get("/threads")
async def list_threads(
    request: Request, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
) -> JSONResponse:
    req_id = getattr(request.state, "request_id", None)
    try:
        threads = await thread_service.list_threads(db, current_user.id)
        return success(
            ThreadListResponse(
                threads=[
                    ThreadSummary(
                        **{
                            "id": str(t.id),
                            "title": t.title,
                            "datasetId": str(t.dataset_id),
                            "updatedAt": t.updated_at,
                        }
                    )
                    for t in threads
                ]
            )
        )
    except Exception as exc:
        logger.exception("Listing threads failed")
        return error(str(exc), "INTERNAL_ERROR", req_id, 500)


@router.get("/threads/{thread_id}/messages")
async def get_thread_messages(
    thread_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    req_id = getattr(request.state, "request_id", None)
    try:
        thread = await thread_service.get_thread(db, thread_id, current_user.id)
        if thread is None:
            return _not_found(req_id)

        detail = await _thread_detail_response(db, thread, current_user)
        if detail is None:
            return error("Dataset for this thread no longer exists.", "NOT_FOUND", req_id, 404)
        return success(detail)
    except Exception as exc:
        logger.exception("Fetching thread messages failed")
        return error(str(exc), "INTERNAL_ERROR", req_id, 500)


@router.post("/threads")
async def create_thread(
    request: Request,
    body: CreateThreadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    req_id = getattr(request.state, "request_id", None)
    try:
        record = await dataset_service.get_dataset_record(db, body.dataset_id, current_user.id)
        if record is None:
            return error("Dataset not found. Please re-upload your file.", "NOT_FOUND", req_id, 404)

        title = body.title or record.filename
        thread = await thread_service.create_thread(db, current_user.id, record.id, title)
        await db.commit()

        detail = await _thread_detail_response(db, thread, current_user)
        return success(detail, 201)
    except Exception as exc:
        logger.exception("Creating thread failed")
        return error(str(exc), "INTERNAL_ERROR", req_id, 500)


@router.patch("/threads/{thread_id}")
async def rename_thread(
    thread_id: str,
    request: Request,
    body: RenameThreadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    req_id = getattr(request.state, "request_id", None)
    try:
        thread = await thread_service.get_thread(db, thread_id, current_user.id)
        if thread is None:
            return _not_found(req_id)

        title = body.title.strip()
        if not title:
            return error("Title cannot be empty.", "VALIDATION_ERROR", req_id, 400)

        await thread_service.rename_thread(db, thread, title)
        await db.commit()

        return success(
            ThreadSummary(
                **{
                    "id": str(thread.id),
                    "title": thread.title,
                    "datasetId": str(thread.dataset_id),
                    "updatedAt": thread.updated_at,
                }
            )
        )
    except Exception as exc:
        logger.exception("Renaming thread failed")
        return error(str(exc), "INTERNAL_ERROR", req_id, 500)


@router.delete("/threads/{thread_id}")
async def delete_thread(
    thread_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    req_id = getattr(request.state, "request_id", None)
    try:
        thread = await thread_service.get_thread(db, thread_id, current_user.id)
        if thread is None:
            return _not_found(req_id)

        await thread_service.delete_thread(db, thread)
        await db.commit()
        return success({"deleted": True})
    except Exception as exc:
        logger.exception("Deleting thread failed")
        return error(str(exc), "INTERNAL_ERROR", req_id, 500)
