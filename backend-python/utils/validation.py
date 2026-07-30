from __future__ import annotations

_DATA_KEYWORDS = [
    "data", "column", "row", "value", "average", "mean", "sum", "count",
    "compare", "trend", "distribution", "correlation", "outlier", "top", "bottom",
    "highest", "lowest", "maximum", "minimum", "total", "percentage", "ratio",
    "group", "category", "chart", "graph", "plot", "visualize", "show", "analyze",
    "analysis", "statistics", "statistical", "breakdown", "breakdown", "insight",
    "pattern", "relationship", "between", "across", "over", "time", "monthly",
    "yearly", "weekly", "daily", "increase", "decrease", "change", "growth",
    "revenue", "sales", "profit", "cost", "price", "quantity", "amount",
]

_MAX_PROMPT_LEN = 2000


def validate_prompt(prompt: str) -> str | None:
    """Return an error message if the prompt is invalid, else None."""
    prompt = prompt.strip()
    if not prompt:
        return "Prompt is required."
    if len(prompt) > _MAX_PROMPT_LEN:
        return f"Prompt must be at most {_MAX_PROMPT_LEN} characters."
    lower = prompt.lower()
    if not any(kw in lower for kw in _DATA_KEYWORDS):
        return "Prompt must be related to data analysis."
    return None


_ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}
_MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def validate_upload(filename: str, size: int) -> str | None:
    if size > _MAX_FILE_SIZE:
        return "File size must not exceed 10 MB."
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in _ALLOWED_EXTENSIONS:
        return f"Only CSV and Excel files are accepted. Got: {ext or 'unknown'}"
    return None


_DOCUMENT_ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md"}
_MAX_DOCUMENT_SIZE = 20 * 1024 * 1024  # 20 MB — more generous than dataset uploads; PDFs run larger than CSVs


def validate_document_upload(filename: str, size: int) -> str | None:
    if size > _MAX_DOCUMENT_SIZE:
        return "File size must not exceed 20 MB."
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in _DOCUMENT_ALLOWED_EXTENSIONS:
        return f"Only PDF, TXT, and Markdown files are accepted. Got: {ext or 'unknown'}"
    return None
