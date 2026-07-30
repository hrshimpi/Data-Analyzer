from __future__ import annotations
import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.api import DocumentListResponse, DocumentResponse, DocumentStatusResponse, DocumentSummary
from models.db import User
from services import dataset_service, document_service, storage_service
from services.auth_service import get_current_user
from utils.response import error, success
from utils.validation import validate_document_upload

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/documents")
async def create_document(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    dataset_id: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    req_id = getattr(request.state, "request_id", None)
    try:
        content = await file.read()
        filename = file.filename or "document"
        err = validate_document_upload(filename, len(content))
        if err:
            return error(err, "VALIDATION_ERROR", req_id, 400)

        try:
            doc_type = document_service.doc_type_from_filename(filename)
        except ValueError as exc:
            return error(str(exc), "VALIDATION_ERROR", req_id, 400)

        dataset_uuid = None
        if dataset_id:
            dataset_record = await dataset_service.get_dataset_record(db, dataset_id, current_user.id)
            if dataset_record is None:
                return error("Dataset not found.", "NOT_FOUND", req_id, 404)
            dataset_uuid = dataset_record.id

        document_id = uuid.uuid4()
        s3_key = await storage_service.upload_document(str(current_user.id), str(document_id), filename, content)

        document = await document_service.create_document(
            db,
            id=document_id,
            user_id=current_user.id,
            dataset_id=dataset_uuid,
            filename=filename,
            s3_bucket=storage_service.bucket_name(),
            s3_key=s3_key,
            doc_type=doc_type,
        )
        await db.commit()

        # Ingestion (text extraction + chunking) runs after the response is
        # sent, using the bytes already read above rather than re-fetching
        # from S3 — the upload above is for durability, not because
        # ingestion needs to round-trip through storage too.
        background_tasks.add_task(document_service.run_ingestion, document_id, filename, content)

        return success(
            DocumentResponse(
                **{
                    "id": str(document.id),
                    "filename": document.filename,
                    "docType": document.doc_type.value,
                    "status": document.status.value,
                    "datasetId": str(dataset_uuid) if dataset_uuid else None,
                    "uploadedAt": document.uploaded_at,
                }
            ),
            201,
        )
    except Exception as exc:
        logger.exception("Document upload failed")
        return error(str(exc), "INTERNAL_ERROR", req_id, 500)


@router.get("/documents")
async def list_documents(
    request: Request, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
) -> JSONResponse:
    req_id = getattr(request.state, "request_id", None)
    try:
        rows = await document_service.list_documents(db, current_user.id)
        return success(
            DocumentListResponse(
                documents=[
                    DocumentSummary(
                        **{
                            "id": str(doc.id),
                            "filename": doc.filename,
                            "docType": doc.doc_type.value,
                            "status": doc.status.value,
                            "datasetId": str(doc.dataset_id) if doc.dataset_id else None,
                            "uploadedAt": doc.uploaded_at,
                            "chunkCount": chunk_count,
                        }
                    )
                    for doc, chunk_count in rows
                ]
            )
        )
    except Exception as exc:
        logger.exception("Listing documents failed")
        return error(str(exc), "INTERNAL_ERROR", req_id, 500)


@router.get("/documents/{document_id}/status")
async def get_document_status(
    document_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    req_id = getattr(request.state, "request_id", None)
    try:
        document = await document_service.get_document(db, document_id, current_user.id)
        if document is None:
            return error("Document not found.", "NOT_FOUND", req_id, 404)

        chunk_count = await document_service.count_chunks(db, document.id)
        return success(
            DocumentStatusResponse(
                **{"id": str(document.id), "status": document.status.value, "chunkCount": chunk_count}
            )
        )
    except Exception as exc:
        logger.exception("Fetching document status failed")
        return error(str(exc), "INTERNAL_ERROR", req_id, 500)
