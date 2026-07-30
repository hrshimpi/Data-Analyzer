from __future__ import annotations
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, UUIDPKMixin

if TYPE_CHECKING:
    from .chat_thread import ChatThread
    from .document import Document
    from .user import User


class Dataset(UUIDPKMixin, Base):
    """A row in the `datasets` table: metadata + S3 location for an
    uploaded file, owned by a user.

    Not to be confused with `models.dataset.Dataset` — the in-memory,
    fully-parsed representation (rows + computed stats) used within a
    single request today. This ORM model is the persisted *pointer* to
    that file (S3 location + the same column/stat schema, serialized),
    not the parsed row data itself.
    """

    __tablename__ = "datasets"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    s3_bucket: Mapped[str] = mapped_column(String(255), nullable=False)
    s3_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    # Column names/types + per-column statistics, same shape as
    # UploadResponse.summary in models/api.py.
    column_schema: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user: Mapped["User"] = relationship(back_populates="datasets")
    chat_threads: Mapped[list["ChatThread"]] = relationship(back_populates="dataset", cascade="all, delete-orphan")
    documents: Mapped[list["Document"]] = relationship(back_populates="dataset", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"Dataset(id={self.id!r}, filename={self.filename!r})"
