from __future__ import annotations
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field


class ColumnInfo(BaseModel):
    name: str
    type: str  # "number" | "string"


class ColumnStats(BaseModel):
    min: Optional[float] = None
    max: Optional[float] = None
    mean: Optional[float] = None
    median: Optional[float] = None
    std_dev: Optional[float] = Field(None, alias="stdDev")
    unique_count: Optional[int] = Field(None, alias="uniqueCount")
    null_count: int = Field(0, alias="nullCount")
    total_count: int = Field(0, alias="totalCount")

    model_config = {"populate_by_name": True}


class UploadResponse(BaseModel):
    file_id: str = Field(alias="fileId")
    file_name: str = Field(alias="fileName")
    columns: list[ColumnInfo]
    summary: dict[str, ColumnStats]

    model_config = {"populate_by_name": True}


class SuggestionsRequest(BaseModel):
    file_id: str = Field(alias="fileId")
    columns: list[ColumnInfo]
    summary: dict[str, Any]

    model_config = {"populate_by_name": True}


class SuggestionsResponse(BaseModel):
    suggestions: list[str]


class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ContextualSuggestionsRequest(BaseModel):
    file_id: str = Field(alias="fileId")
    recent_chats: list[ChatMessage] = Field(alias="recentChats")

    model_config = {"populate_by_name": True}


class AnalyzeRequest(BaseModel):
    file_id: str = Field(alias="fileId")
    prompt: str
    thread_id: Optional[str] = Field(None, alias="threadId")

    model_config = {"populate_by_name": True}


class ChartConfig(BaseModel):
    type: str
    title: str
    x: Optional[str] = None
    y: Optional[str] = None
    size: Optional[str] = None
    category: Optional[str] = None
    value: Optional[str] = None
    columns: Optional[list[str]] = None
    data: list[dict[str, Any]] = []


class AnalyzeResponse(BaseModel):
    insights: str
    charts: list[ChartConfig]
    chart_status: str = Field(alias="chartStatus")
    chart_message: str = Field(alias="chartMessage")
    retry_attempts: int = Field(alias="retryAttempts")
    # Filled in by the /analyze handler via model_copy(update=...) once the
    # thread is known — analysis_engine.process_analysis() constructs this
    # response without any notion of threads, so these need defaults.
    # title reflects the thread's title *after* this call, which may have
    # just changed (a thread's title is overwritten by its first message) —
    # returned here so the frontend can keep its sidebar list in sync
    # without a second round trip or re-deriving the same logic locally.
    thread_id: str = Field("", alias="threadId")
    title: str = ""

    model_config = {"populate_by_name": True}


class ErrorResponse(BaseModel):
    error: str
    code: str
    request_id: Optional[str] = Field(None, alias="requestId")

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# Chat threads
# ---------------------------------------------------------------------------

class ThreadSummary(BaseModel):
    id: str
    title: str
    dataset_id: str = Field(alias="datasetId")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = {"populate_by_name": True}


class ThreadListResponse(BaseModel):
    threads: list[ThreadSummary]


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    chart_configs: Optional[dict[str, Any]] = Field(None, alias="chartConfigs")
    created_at: datetime = Field(alias="createdAt")

    model_config = {"populate_by_name": True}


class ThreadDetailResponse(BaseModel):
    thread_id: str = Field(alias="threadId")
    title: str
    dataset_id: str = Field(alias="datasetId")
    file_name: str = Field(alias="fileName")
    columns: list[ColumnInfo]
    summary: dict[str, ColumnStats]
    messages: list[MessageOut]

    model_config = {"populate_by_name": True}


class CreateThreadRequest(BaseModel):
    dataset_id: str = Field(alias="datasetId")
    title: Optional[str] = None

    model_config = {"populate_by_name": True}


class RenameThreadRequest(BaseModel):
    title: str
