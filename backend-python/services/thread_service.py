from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.db import ChatThread, Message, MessageRole


def _parse_uuid(value: str) -> Optional[uuid.UUID]:
    try:
        return uuid.UUID(value)
    except ValueError:
        return None


async def list_threads(db: AsyncSession, user_id: uuid.UUID) -> list[ChatThread]:
    result = await db.execute(
        select(ChatThread).where(ChatThread.user_id == user_id).order_by(ChatThread.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_thread(db: AsyncSession, thread_id: str, user_id: uuid.UUID) -> Optional[ChatThread]:
    """Ownership-scoped lookup — a malformed ID, a missing thread, and a
    thread belonging to a different user are all just "not found"."""
    thread_uuid = _parse_uuid(thread_id)
    if thread_uuid is None:
        return None
    result = await db.execute(
        select(ChatThread).where(ChatThread.id == thread_uuid, ChatThread.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def get_messages(db: AsyncSession, thread_id: uuid.UUID) -> list[Message]:
    result = await db.execute(
        select(Message).where(Message.thread_id == thread_id).order_by(Message.created_at)
    )
    return list(result.scalars().all())


async def create_thread(db: AsyncSession, user_id: uuid.UUID, dataset_id: uuid.UUID, title: str) -> ChatThread:
    thread = ChatThread(user_id=user_id, dataset_id=dataset_id, title=title)
    db.add(thread)
    await db.flush()
    return thread


async def rename_thread(db: AsyncSession, thread: ChatThread, title: str) -> None:
    thread.title = title
    thread.updated_at = datetime.now(timezone.utc)


async def delete_thread(db: AsyncSession, thread: ChatThread) -> None:
    # Messages cascade via the FK's ON DELETE CASCADE (see models/db/message.py).
    await db.delete(thread)


async def append_message(
    db: AsyncSession,
    thread: ChatThread,
    role: MessageRole,
    content: str,
    chart_configs: Optional[dict[str, Any]] = None,
) -> Message:
    count_result = await db.execute(select(func.count()).select_from(Message).where(Message.thread_id == thread.id))
    is_first_message = count_result.scalar_one() == 0

    message = Message(thread_id=thread.id, role=role, content=content, chart_configs=chart_configs)
    db.add(message)

    # Mirrors the old frontend-local behavior: a thread's title starts as
    # the dataset filename (set at creation) and is overwritten by the
    # first message's content once the conversation actually starts.
    if is_first_message and role == MessageRole.USER:
        thread.title = content[:50]
    thread.updated_at = datetime.now(timezone.utc)

    await db.flush()
    return message
