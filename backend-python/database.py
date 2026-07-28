from __future__ import annotations
import os
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine


def async_database_url() -> str:
    """Read DATABASE_URL and adapt it for the asyncpg driver.

    Kept as a plain `postgresql://` URL in .env so it also works as-is
    with generic tools (psql, GUI clients, Alembic's own default sync
    mode) — only the async SQLAlchemy engine needs the `+asyncpg` bit,
    so that adaptation happens here rather than in the env var itself.
    """
    url = os.environ["DATABASE_URL"]
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = create_async_engine(async_database_url(), pool_pre_ping=True)
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(), expire_on_commit=False)
    return _session_factory


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: `db: AsyncSession = Depends(get_db)`."""
    async with get_session_factory()() as session:
        yield session
