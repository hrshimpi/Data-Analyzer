from __future__ import annotations
import uuid

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class UUIDPKMixin:
    """Server-generated UUID primary key.

    Generated in Postgres (gen_random_uuid(), built into core since PG13)
    rather than app-side, so direct SQL inserts/bulk loads still get a
    valid PK without going through the ORM.
    """

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
