from __future__ import annotations
import io
import re

import tiktoken
from pypdf import PdfReader

# cl100k_base doesn't need to match Gemini's actual tokenizer — it's used
# purely as a consistent, fast proxy for "roughly how much text is this"
# so chunk sizing is repeatable, not for anything that has to line up
# exactly with billed/model tokens.
_ENCODING = tiktoken.get_encoding("cl100k_base")

TARGET_CHUNK_TOKENS = 500
CHUNK_OVERLAP_TOKENS = 50

_SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".md"}


def count_tokens(text: str) -> int:
    return len(_ENCODING.encode(text))


def _extension(filename: str) -> str:
    return "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def extract_text(filename: str, content: bytes) -> str:
    """Raises on anything unparseable (corrupt PDF, undecodable bytes for a
    .txt/.md) — the caller is expected to catch this and mark the document
    failed, per the ingestion pipeline's error handling."""
    ext = _extension(filename)
    if ext == ".pdf":
        return _extract_pdf_text(content)
    if ext in (".txt", ".md"):
        return content.decode("utf-8")
    raise ValueError(f"Unsupported document type: {ext or 'unknown'}")


def _extract_pdf_text(content: bytes) -> str:
    reader = PdfReader(io.BytesIO(content))
    pages = [page.extract_text() or "" for page in reader.pages]
    text = "\n\n".join(pages).strip()
    if not text:
        raise ValueError("No extractable text found in PDF (scanned/image-only PDFs aren't supported yet).")
    return text


def _split_paragraphs(text: str) -> list[str]:
    return [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]


def _split_sentences(paragraph: str) -> list[str]:
    # Naive sentence boundary — doesn't need to be linguistically perfect,
    # just needs to break an oversized paragraph into smaller pieces.
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", paragraph) if s.strip()]


def _hard_split_by_tokens(text: str, max_tokens: int) -> list[str]:
    """Last-resort split for a single chunk of text with no sentence/
    paragraph boundaries (e.g. one giant run-on line) that's still too
    large — slices by raw token count so no unit can ever exceed
    max_tokens regardless of punctuation."""
    tokens = _ENCODING.encode(text)
    return [_ENCODING.decode(tokens[i : i + max_tokens]) for i in range(0, len(tokens), max_tokens)]


def _units_from_text(text: str, max_tokens: int) -> list[str]:
    """Break text into pieces no larger than max_tokens each, preferring
    paragraph boundaries, then sentence boundaries, then a hard token
    split as a last resort — these get greedily repacked into chunks by
    `chunk_text`."""
    units: list[str] = []
    for paragraph in _split_paragraphs(text):
        if count_tokens(paragraph) <= max_tokens:
            units.append(paragraph)
            continue
        for sentence in _split_sentences(paragraph):
            if count_tokens(sentence) <= max_tokens:
                units.append(sentence)
            else:
                units.extend(_hard_split_by_tokens(sentence, max_tokens))
    return units


def _tail_by_tokens(text: str, n_tokens: int) -> str:
    tokens = _ENCODING.encode(text)
    if len(tokens) <= n_tokens:
        return text
    return _ENCODING.decode(tokens[-n_tokens:])


def chunk_text(
    text: str,
    target_tokens: int = TARGET_CHUNK_TOKENS,
    overlap_tokens: int = CHUNK_OVERLAP_TOKENS,
) -> list[str]:
    """Recursive/token-aware splitter: paragraph -> sentence -> raw token
    window (whichever produces small-enough pieces), greedily packed into
    ~target_tokens chunks, each starting with ~overlap_tokens of trailing
    context carried over from the previous chunk so nothing at a chunk
    boundary loses its surrounding context entirely."""
    units = _units_from_text(text, target_tokens)
    if not units:
        return []

    chunks: list[str] = []
    current_units: list[str] = []
    current_tokens = 0

    for unit in units:
        unit_tokens = count_tokens(unit)
        if current_units and current_tokens + unit_tokens > target_tokens:
            chunk_str = "\n\n".join(current_units)
            chunks.append(chunk_str)
            overlap_text = _tail_by_tokens(chunk_str, overlap_tokens)
            current_units = [overlap_text] if overlap_text else []
            current_tokens = count_tokens(overlap_text) if overlap_text else 0

        current_units.append(unit)
        current_tokens += unit_tokens

    if current_units:
        chunks.append("\n\n".join(current_units))

    return chunks
