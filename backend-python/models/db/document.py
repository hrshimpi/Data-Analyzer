from __future__ import annotations
import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, UUIDPKMixin

if TYPE_CHECKING:
    from .dataset import Dataset
    from .document_chunk import DocumentChunk
    from .user import User


class DocumentType(str, enum.Enum):
    PDF = "pdf"
    TXT = "txt"
    MD = "md"


class DocumentStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class Document(UUIDPKMixin, Base):
    """A supporting document (PDF/txt/md) uploaded for RAG — the source
    file this document was chunked from lives in S3 (`s3_bucket`/`s3_key`,
    same pattern as `Dataset`); the chunks themselves are `DocumentChunk`
    rows, produced asynchronously (`status` tracks that pipeline).
    """

    __tablename__ = "documents"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Nullable: a document can be scoped to one dataset (e.g. a data
    # dictionary for that specific upload) or general-purpose (not tied
    # to any single dataset) — ondelete="CASCADE" only applies when set.
    dataset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=True, index=True
    )
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    s3_bucket: Mapped[str] = mapped_column(String(255), nullable=False)
    s3_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    doc_type: Mapped[DocumentType] = mapped_column(
        SAEnum(DocumentType, name="document_type", values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
    )
    # values_callable, as in Message.role: store lowercase enum values
    # ("pending", "ready") rather than SQLAlchemy's default member names.
    status: Mapped[DocumentStatus] = mapped_column(
        SAEnum(DocumentStatus, name="document_status", values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
        server_default=DocumentStatus.PENDING.value,
    )
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user: Mapped["User"] = relationship(back_populates="documents")
    dataset: Mapped["Dataset | None"] = relationship(back_populates="documents")
    chunks: Mapped[list["DocumentChunk"]] = relationship(
        back_populates="document", cascade="all, delete-orphan", order_by="DocumentChunk.chunk_index"
    )

    def __repr__(self) -> str:
        return f"Document(id={self.id!r}, filename={self.filename!r}, status={self.status!r})"
