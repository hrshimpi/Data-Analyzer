from __future__ import annotations
import asyncio
import json
import logging
import os
import re
from typing import Any

import google.auth
import google.auth.transport.requests
import httpx

from models.api import ColumnInfo, ChatMessage

logger = logging.getLogger(__name__)

_API_VERSION = "v1"

# Cached across requests so we don't do a full OAuth refresh on every single
# call — google-auth's refresh() is a blocking network call, so it's also
# run off the event loop thread via asyncio.to_thread.
_creds = None
_creds_lock = asyncio.Lock()


def _get_model() -> str:
    return os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")


def _get_endpoint() -> str:
    project = os.environ["GOOGLE_CLOUD_PROJECT_ID"]
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
    return (
        f"https://{location}-aiplatform.googleapis.com/{_API_VERSION}"
        f"/projects/{project}/locations/{location}"
        f"/publishers/google/models/{_get_model()}:generateContent"
    )


def _refresh_creds_sync() -> str:
    global _creds
    if _creds is None:
        _creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    if not _creds.valid:
        _creds.refresh(google.auth.transport.requests.Request())
    return _creds.token


async def _get_access_token() -> str:
    async with _creds_lock:
        return await asyncio.to_thread(_refresh_creds_sync)


async def _call_gemini(prompt: str) -> str:
    token = await _get_access_token()
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 8192,
        },
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            _get_endpoint(),
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    response.raise_for_status()
    data = response.json()
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as exc:
        raise RuntimeError(f"Unexpected Gemini response structure: {data}") from exc


def _extract_json(text: str) -> Any:
    """Extract the first JSON object or array from a Gemini response."""
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strip markdown fences
    clean = re.sub(r"```(?:json)?", "", text).strip().rstrip("`").strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        pass

    # Find first [ or { and attempt to parse from there
    for start_char, end_char in [("[", "]"), ("{", "}")]:
        start = clean.find(start_char)
        if start == -1:
            continue
        # Find matching closing bracket
        depth = 0
        for i, ch in enumerate(clean[start:], start=start):
            if ch == start_char:
                depth += 1
            elif ch == end_char:
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(clean[start : i + 1])
                    except json.JSONDecodeError:
                        break

    raise ValueError(f"Could not extract JSON from response: {text[:200]}")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def get_suggestions(columns: list[ColumnInfo], summary: dict[str, Any]) -> list[str]:
    col_desc = ", ".join(f"{c.name} ({c.type})" for c in columns)
    summary_text = json.dumps(
        {k: v.model_dump(by_alias=True) if hasattr(v, "model_dump") else v for k, v in summary.items()},
        default=str,
    )
    prompt = f"""You are a data analyst. Given a dataset with columns: {col_desc}

Dataset statistics:
{summary_text}

Generate 2-3 specific, business-relevant analysis questions or suggestions that would provide meaningful insights from this data.
Focus on patterns, trends, correlations, and outliers.

Return ONLY a JSON array of strings, no other text:
["suggestion 1", "suggestion 2", ...]"""

    text = await _call_gemini(prompt)
    result = _extract_json(text)
    if isinstance(result, list):
        return [str(s) for s in result]
    raise ValueError("Suggestions response is not a list")


async def get_contextual_suggestions(
    columns: list[ColumnInfo],
    summary: dict[str, Any],
    recent_chats: list[ChatMessage],
) -> list[str]:
    col_desc = ", ".join(f"{c.name} ({c.type})" for c in columns)
    chat_text = "\n".join(f"{m.role}: {m.content}" for m in recent_chats[-6:])
    prompt = f"""You are a data analyst assistant. The dataset has columns: {col_desc}

Recent conversation:
{chat_text}

Based on what has already been discussed, generate 2-3 follow-up questions that would deepen the analysis or explore new angles. Avoid repeating what was already asked.

Return ONLY a JSON array of strings:
["question 1", "question 2", ...]"""

    text = await _call_gemini(prompt)
    result = _extract_json(text)
    if isinstance(result, list):
        return [str(s) for s in result]
    raise ValueError("Contextual suggestions response is not a list")


async def analyze(dataset_context: str, prompt: str) -> str:
    """Step 1 – pure text insights."""
    full_prompt = f"""You are an expert data analyst. Analyze the following dataset and answer the user's question with clear, actionable insights.

Dataset information:
{dataset_context}

User question: {prompt}

Provide a comprehensive analysis with specific observations, patterns, and recommendations. Be concise but thorough."""
    return await _call_gemini(full_prompt)


async def generate_charts(dataset_context: str, prompt: str, insights: str) -> list[dict[str, Any]]:
    """Step 2 – chart configuration JSON."""
    full_prompt = f"""You are a data visualization expert. Based on the analysis below, generate chart configurations.

Dataset information:
{dataset_context}

User question: {prompt}

Analysis insights:
{insights}

Generate 1-3 chart configurations that best visualize the insights. Use ONLY column names that exist in the dataset.

Supported chart types: bar, line, scatter, pie, area, combo, histogram, boxplot, bubble, correlation

Return ONLY a JSON array of chart config objects:
[
  {{
    "type": "bar",
    "title": "Chart Title",
    "x": "column_name",
    "y": "column_name"
  }},
  {{
    "type": "pie",
    "title": "Pie Chart Title",
    "category": "column_name",
    "value": "column_name"
  }},
  {{
    "type": "histogram",
    "title": "Distribution Title",
    "x": "numeric_column_name"
  }},
  {{
    "type": "correlation",
    "title": "Correlation Matrix",
    "columns": ["col1", "col2", "col3"]
  }},
  {{
    "type": "bubble",
    "title": "Bubble Chart",
    "x": "col1",
    "y": "col2",
    "size": "col3"
  }}
]

Rules:
- Only use column names that exist in the dataset
- For scatter/line/area/bar: x and y fields required
- For pie: category and value fields required
- For histogram/boxplot: x field required (numeric column)
- For correlation: columns array required (numeric columns only)
- For bubble: x, y, size fields required (all numeric)
- For combo: x, y fields required"""

    text = await _call_gemini(full_prompt)
    result = _extract_json(text)
    if isinstance(result, list):
        return result
    if isinstance(result, dict):
        return [result]
    return []
