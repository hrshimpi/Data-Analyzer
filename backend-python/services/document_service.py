from __future__ import annotations
import logging
import uuid
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session_factory
from models.db import Document, DocumentChunk, DocumentStatus, DocumentType
from services import chunking_service

logger = logging.getLogger(__name__)

_EXTENSION_TO_TYPE = {".pdf": DocumentType.PDF, ".txt": DocumentType.TXT, ".md": DocumentType.MD}


def doc_type_from_filename(filename: str) -> DocumentType:
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    try:
        return _EXTENSION_TO_TYPE[ext]
    except KeyError:
        raise ValueError(f"Unsupported document type: {ext or 'unknown'}") from None


def _parse_uuid(value: str) -> Optional[uuid.UUID]:
    try:
        return uuid.UUID(value)
    except ValueError:
        return None


async def create_document(
    db: AsyncSession,
    *,
    id: uuid.UUID,
    user_id: uuid.UUID,
    dataset_id: Optional[uuid.UUID],
    filename: str,
    s3_bucket: str,
    s3_key: str,
    doc_type: DocumentType,
) -> Document:
    document = Document(
        id=id,
        user_id=user_id,
        dataset_id=dataset_id,
        filename=filename,
        s3_bucket=s3_bucket,
        s3_key=s3_key,
        doc_type=doc_type,
        status=DocumentStatus.PENDING,
    )
    db.add(document)
    await db.flush()
    return document


async def get_document(db: AsyncSession, document_id: str, user_id: uuid.UUID) -> Optional[Document]:
    """Ownership-scoped lookup — a malformed ID, a missing row, and a row
    belonging to a different user are all just "not found" to callers,
    same pattern as dataset_service.get_dataset_record."""
    doc_uuid = _parse_uuid(document_id)
    if doc_uuid is None:
        return None
    result = await db.execute(select(Document).where(Document.id == doc_uuid, Document.user_id == user_id))
    return result.scalar_one_or_none()


async def list_documents(db: AsyncSession, user_id: uuid.UUID) -> list[tuple[Document, int]]:
    """Each document paired with its current chunk count, most recently
    uploaded first — one query via an outer join + grouped subquery
    instead of N+1 count queries per document."""
    chunk_counts = (
        select(DocumentChunk.document_id, func.count().label("chunk_count"))
        .group_by(DocumentChunk.document_id)
        .subquery()
    )
    result = await db.execute(
        select(Document, func.coalesce(chunk_counts.c.chunk_count, 0))
        .outerjoin(chunk_counts, Document.id == chunk_counts.c.document_id)
        .where(Document.user_id == user_id)
        .order_by(Document.uploaded_at.desc())
    )
    return [(row[0], row[1]) for row in result.all()]


async def count_chunks(db: AsyncSession, document_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count()).select_from(DocumentChunk).where(DocumentChunk.document_id == document_id)
    )
    return result.scalar_one()


async def run_ingestion(document_id: uuid.UUID, filename: str, content: bytes) -> None:
    """Background task: extract text, chunk it, insert DocumentChunk rows
    (embedding left NULL — a later step fills it in), then flip
    Document.status to ready/failed.

    Runs in its own DB session rather than reusing the request's — the
    request's session is closed by the time a FastAPI BackgroundTasks
    callback actually runs (it fires after the response has been sent),
    so sharing it here would be relying on undefined/fragile lifetime
    behavior instead of a session scoped to this task's own lifetime.
    """
    async with get_session_factory()() as db:
        try:
            text = chunking_service.extract_text(filename, content)
            chunks = chunking_service.chunk_text(text)
            if not chunks:
                raise ValueError("Document produced no chunks (empty after text extraction).")

            for index, chunk in enumerate(chunks):
                db.add(
                    DocumentChunk(
                        document_id=document_id,
                        chunk_index=index,
                        content=chunk,
                        embedding=None,
                        token_count=chunking_service.count_tokens(chunk),
                    )
                )

            result = await db.execute(select(Document).where(Document.id == document_id))
            document = result.scalar_one_or_none()
            if document is None:
                logger.error("Ingestion: document %s no longer exists, discarding chunks", document_id)
                await db.rollback()
                return

            document.status = DocumentStatus.READY
            await db.commit()
            logger.info("Ingestion complete for document %s: %d chunks", document_id, len(chunks))

        except Exception:
            logger.exception("Ingestion failed for document %s", document_id)
            await db.rollback()
            result = await db.execute(select(Document).where(Document.id == document_id))
            document = result.scalar_one_or_none()
            if document is not None:
                document.status = DocumentStatus.FAILED
                await db.commit()
