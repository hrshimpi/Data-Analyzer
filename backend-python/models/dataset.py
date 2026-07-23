from __future__ import annotations
import io
import math
import csv
from typing import Any, Optional
import pandas as pd
import numpy as np

from models.api import ColumnInfo, ColumnStats
from utils.errors import ValidationError

MAX_ROWS = 200_000
MAX_COLUMNS = 200


class Dataset:
    def __init__(self, file_name: str, rows: list[dict[str, Any]], columns: list[ColumnInfo], summary: dict[str, ColumnStats]):
        self.file_name = file_name
        self.rows = rows
        self.columns = columns
        self.summary = summary

    def get_column_data(self, col_name: str) -> list[Any]:
        return [row.get(col_name) for row in self.rows]

    def get_numeric_column(self, col_name: str) -> list[float]:
        result = []
        for row in self.rows:
            val = row.get(col_name)
            if val is not None:
                try:
                    result.append(float(val))
                except (TypeError, ValueError):
                    pass
        return result

    def get_column_names(self) -> list[str]:
        return [c.name for c in self.columns]

    def get_numeric_column_names(self) -> list[str]:
        return [c.name for c in self.columns if c.type == "number"]

    def get_string_column_names(self) -> list[str]:
        return [c.name for c in self.columns if c.type == "string"]


def parse_file(file_name: str, content: bytes) -> Dataset:
    lower = file_name.lower()
    if lower.endswith(".csv"):
        return _parse_csv(file_name, content)
    elif lower.endswith(".xlsx") or lower.endswith(".xls"):
        return _parse_excel(file_name, content)
    else:
        raise ValueError(f"Unsupported file type: {file_name}")


def _parse_csv(file_name: str, content: bytes) -> Dataset:
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    rows = [dict(row) for row in reader]
    return _build_dataset(file_name, rows)


def _parse_excel(file_name: str, content: bytes) -> Dataset:
    df = pd.read_excel(io.BytesIO(content), dtype=str)
    df = df.fillna("")
    rows = df.to_dict(orient="records")
    return _build_dataset(file_name, rows)


def _build_dataset(file_name: str, rows: list[dict[str, Any]]) -> Dataset:
    if not rows:
        return Dataset(file_name, [], [], {})

    if len(rows) > MAX_ROWS:
        raise ValidationError(f"File has {len(rows)} rows; the maximum supported is {MAX_ROWS}.")

    headers = list(rows[0].keys())

    if len(headers) > MAX_COLUMNS:
        raise ValidationError(f"File has {len(headers)} columns; the maximum supported is {MAX_COLUMNS}.")
    columns: list[ColumnInfo] = []
    summary: dict[str, ColumnStats] = {}

    for header in headers:
        col_vals = [row.get(header) for row in rows]
        col_type, stats = _infer_type_and_stats(col_vals)
        columns.append(ColumnInfo(name=header, type=col_type))
        summary[header] = stats

    return Dataset(file_name, rows, columns, summary)


def _infer_type_and_stats(values: list[Any]) -> tuple[str, ColumnStats]:
    total = len(values)
    null_count = sum(1 for v in values if v is None or v == "")

    numeric_vals: list[float] = []
    for v in values:
        if v is None or v == "":
            continue
        try:
            numeric_vals.append(float(str(v).strip()))
        except (ValueError, TypeError):
            pass

    # Consider numeric if >= 80% of non-null values parse as float
    non_null = total - null_count
    is_numeric = non_null > 0 and (len(numeric_vals) / non_null) >= 0.8

    if is_numeric:
        arr = np.array(numeric_vals)
        stats = ColumnStats(
            **{
                "min": float(np.min(arr)) if len(arr) else None,
                "max": float(np.max(arr)) if len(arr) else None,
                "mean": float(np.mean(arr)) if len(arr) else None,
                "median": float(np.median(arr)) if len(arr) else None,
                "stdDev": float(np.std(arr, ddof=1)) if len(arr) > 1 else 0.0,
                "uniqueCount": None,
                "nullCount": null_count,
                "totalCount": total,
            }
        )
        return "number", stats
    else:
        str_vals = [str(v) for v in values if v is not None and v != ""]
        unique_count = len(set(str_vals))
        stats = ColumnStats(
            **{
                "min": None,
                "max": None,
                "mean": None,
                "median": None,
                "stdDev": None,
                "uniqueCount": unique_count,
                "nullCount": null_count,
                "totalCount": total,
            }
        )
        return "string", stats
