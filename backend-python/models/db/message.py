from __future__ import annotations
import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Index, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, UUIDPKMixin

if TYPE_CHECKING:
    from .chat_thread import ChatThread


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"


class Message(UUIDPKMixin, Base):
    __tablename__ = "messages"
    __table_args__ = (
        # Every read of a conversation filters by thread_id and orders by
        # created_at — a composite index serves both the FK lookup and the
        # ordering in one pass, so there's no separate single-column index
        # on thread_id (this one already covers that as a leftmost prefix).
        Index("ix_messages_thread_id_created_at", "thread_id", "created_at"),
    )

    thread_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_threads.id", ondelete="CASCADE"), nullable=False
    )
    # values_callable: store the lowercase enum *values* ("user", "assistant")
    # rather than SQLAlchemy's default of the member *names* ("USER",
    # "ASSISTANT") — matches the role strings used everywhere else (the
    # REST API in models/api.py, and the frontend's ChatMessage.role).
    role: Mapped[MessageRole] = mapped_column(
        SAEnum(MessageRole, name="message_role", values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Validated chart configs + data, same shape as AnalyzeResponse.charts
    # in models/api.py. Nullable — plenty of messages (user turns, or
    # assistant turns where no chart was feasible) have none.
    chart_configs: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    thread: Mapped["ChatThread"] = relationship(back_populates="messages")

    def __repr__(self) -> str:
        return f"Message(id={self.id!r}, role={self.role!r})"
