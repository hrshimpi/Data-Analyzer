from __future__ import annotations
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Index, Integer, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, UUIDPKMixin

if TYPE_CHECKING:
    from .document import Document

# Dimension of the embedding vectors stored below. Chosen to match Gemini's
# text-embedding-004 (768-dim output) — the model Prompt 3 (embedding
# generation) is expected to use. If a different embedding model/dimension
# is picked there instead, this constant and the migration that reads it
# both need updating together, since a pgvector column's dimension is fixed
# at creation time (changing it means a new migration, not just an app
# restart).
EMBEDDING_DIM = 768


class DocumentChunk(UUIDPKMixin, Base):
    """A single chunk of a `Document`, with its embedding — the unit that
    RAG retrieval actually searches over via approximate nearest-neighbor
    search on `embedding` (see the HNSW index in the Alembic migration).
    """

    __tablename__ = "document_chunks"
    __table_args__ = (
        # HNSW over cosine distance — matches the `<=>` operator used at
        # query time (`ORDER BY embedding <=> :query_vector`). pgvector
        # requires the index's ops class to match the distance operator
        # used in the query for the index to actually be used; built with
        # `postgresql_using`/`postgresql_ops` here since SQLAlchemy has no
        # first-class pgvector index API.
        Index(
            "ix_document_chunks_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Nullable: ingestion (chunking) and embedding are deliberately separate
    # steps (this prompt inserts chunks with embedding=NULL; a later prompt
    # fills it in), so a chunk can legitimately exist without one yet.
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM), nullable=True)
    token_count: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    document: Mapped["Document"] = relationship(back_populates="chunks")

    def __repr__(self) -> str:
        return f"DocumentChunk(id={self.id!r}, document_id={self.document_id!r}, chunk_index={self.chunk_index!r})"
