from __future__ import annotations
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

    model_config = {"populate_by_name": True}


class ErrorResponse(BaseModel):
    error: str
    code: str
    request_id: Optional[str] = Field(None, alias="requestId")

    model_config = {"populate_by_name": True}
