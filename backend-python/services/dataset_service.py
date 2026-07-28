from __future__ import annotations
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.api import ColumnInfo, ColumnStats
from models.dataset import Dataset as ParsedDataset, parse_file
from models.db import Dataset as DatasetRecord
from services import storage_service


async def get_dataset_record(db: AsyncSession, dataset_id: str, user_id) -> Optional[DatasetRecord]:
    """Look up a dataset's metadata row by ID, scoped to its owner.

    A malformed ID, a missing row, and a row that belongs to a *different*
    user are all just "not found" to callers — same response for all
    three, so a valid token for someone else's account can't be used to
    even confirm another user's dataset ID exists.
    """
    try:
        dataset_uuid = uuid.UUID(dataset_id)
    except ValueError:
        return None
    result = await db.execute(
        select(DatasetRecord).where(DatasetRecord.id == dataset_uuid, DatasetRecord.user_id == user_id)
    )
    return result.scalar_one_or_none()


def schema_from_record(record: DatasetRecord) -> tuple[list[ColumnInfo], dict[str, ColumnStats]]:
    """Column names/types + statistics only, straight from the stored
    JSONB — no S3 round trip. Enough for /suggestions and
    /contextual-suggestions, which never touch row-level data."""
    columns = [ColumnInfo(**c) for c in record.column_schema["columns"]]
    summary = {name: ColumnStats(**stats) for name, stats in record.column_schema["summary"].items()}
    return columns, summary


async def load_parsed_dataset(record: DatasetRecord) -> ParsedDataset:
    """The full dataset with row-level data — fetches the raw file from
    storage and re-parses it. Needed by /analyze, which samples actual
    rows for chart generation; not needed for schema-only endpoints."""
    raw_bytes = await storage_service.get_file(record.s3_key)
    return parse_file(record.filename, raw_bytes)
