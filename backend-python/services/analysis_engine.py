from __future__ import annotations
import json
import logging
import math
from collections import defaultdict
from typing import Any

import numpy as np

from models.api import AnalyzeResponse, ChartConfig, ColumnInfo
from models.dataset import Dataset
from services import gemini

logger = logging.getLogger(__name__)

_MAX_RETRIES = 3
_MAX_ROWS_FOR_CHART = 500


def _build_dataset_context(dataset: Dataset) -> str:
    col_desc = ", ".join(f"{c.name} ({c.type})" for c in dataset.columns)
    summary_lines = []
    for col_name, stats in dataset.summary.items():
        col = next((c for c in dataset.columns if c.name == col_name), None)
        if col and col.type == "number":
            summary_lines.append(
                f"  {col_name}: min={stats.min}, max={stats.max}, mean={stats.mean:.2f}, stdDev={stats.std_dev:.2f}"
            )
        else:
            summary_lines.append(f"  {col_name}: {stats.unique_count} unique values, {stats.null_count} nulls")
    summary_text = "\n".join(summary_lines)
    return f"Columns: {col_desc}\nTotal rows: {len(dataset.rows)}\nStatistics:\n{summary_text}"


def _valid_column(dataset: Dataset, name: str | None) -> bool:
    if not name:
        return False
    return any(c.name == name for c in dataset.columns)


def _is_numeric_column(dataset: Dataset, name: str) -> bool:
    return any(c.name == name and c.type == "number" for c in dataset.columns)


def _validate_chart(chart: dict[str, Any], dataset: Dataset) -> bool:
    chart_type = chart.get("type", "")
    if chart_type in ("bar", "line", "scatter", "area", "combo"):
        return _valid_column(dataset, chart.get("x")) and _valid_column(dataset, chart.get("y"))
    if chart_type == "pie":
        return _valid_column(dataset, chart.get("category")) and _valid_column(dataset, chart.get("value"))
    if chart_type in ("histogram", "boxplot"):
        return _valid_column(dataset, chart.get("x")) and _is_numeric_column(dataset, chart.get("x", ""))
    if chart_type == "bubble":
        return (
            _valid_column(dataset, chart.get("x"))
            and _valid_column(dataset, chart.get("y"))
            and _valid_column(dataset, chart.get("size"))
        )
    if chart_type == "correlation":
        cols = chart.get("columns") or []
        return len(cols) >= 2 and all(_valid_column(dataset, c) and _is_numeric_column(dataset, c) for c in cols)
    return False


# ---------------------------------------------------------------------------
# Chart data generators
# ---------------------------------------------------------------------------

def _sample_rows(rows: list[dict], max_rows: int) -> list[dict]:
    if len(rows) <= max_rows:
        return rows
    step = len(rows) // max_rows
    return rows[::step][:max_rows]


def _generate_xy_data(dataset: Dataset, chart: dict) -> list[dict[str, Any]]:
    x_col, y_col = chart["x"], chart["y"]
    rows = _sample_rows(dataset.rows, _MAX_ROWS_FOR_CHART)
    data = []
    for row in rows:
        x_val = row.get(x_col)
        y_val = row.get(y_col)
        if x_val is None or y_val is None or x_val == "" or y_val == "":
            continue
        try:
            data.append({x_col: x_val, y_col: float(y_val)})
        except (ValueError, TypeError):
            data.append({x_col: x_val, y_col: y_val})
    return data


def _generate_pie_data(dataset: Dataset, chart: dict) -> list[dict[str, Any]]:
    cat_col, val_col = chart["category"], chart["value"]
    agg: dict[str, float] = defaultdict(float)
    for row in dataset.rows:
        cat = str(row.get(cat_col, ""))
        val = row.get(val_col)
        if cat and val is not None and val != "":
            try:
                agg[cat] += float(val)
            except (ValueError, TypeError):
                agg[cat] += 1
    # Top 10 categories
    sorted_items = sorted(agg.items(), key=lambda kv: kv[1], reverse=True)[:10]
    return [{cat_col: k, val_col: v} for k, v in sorted_items]


def _generate_histogram_data(dataset: Dataset, chart: dict) -> list[dict[str, Any]]:
    x_col = chart["x"]
    values = dataset.get_numeric_column(x_col)
    if not values:
        return []
    arr = np.array(values)
    n_bins = min(20, max(5, int(math.sqrt(len(arr)))))
    counts, bin_edges = np.histogram(arr, bins=n_bins)
    data = []
    for i, count in enumerate(counts):
        bin_start = round(float(bin_edges[i]), 4)
        bin_end = round(float(bin_edges[i + 1]), 4)
        data.append({"bin": f"{bin_start}-{bin_end}", "count": int(count), x_col: bin_start})
    return data


def _generate_boxplot_data(dataset: Dataset, chart: dict) -> list[dict[str, Any]]:
    x_col = chart["x"]
    values = dataset.get_numeric_column(x_col)
    if not values:
        return []
    arr = np.array(sorted(values))
    q1 = float(np.percentile(arr, 25))
    median = float(np.percentile(arr, 50))
    q3 = float(np.percentile(arr, 75))
    iqr = q3 - q1
    whisker_low = float(np.min(arr[arr >= q1 - 1.5 * iqr]))
    whisker_high = float(np.max(arr[arr <= q3 + 1.5 * iqr]))
    outliers = arr[(arr < whisker_low) | (arr > whisker_high)].tolist()
    return [{
        "column": x_col,
        "min": whisker_low,
        "q1": q1,
        "median": median,
        "q3": q3,
        "max": whisker_high,
        "outliers": outliers[:50],
    }]


def _generate_bubble_data(dataset: Dataset, chart: dict) -> list[dict[str, Any]]:
    x_col, y_col, size_col = chart["x"], chart["y"], chart["size"]
    rows = _sample_rows(dataset.rows, _MAX_ROWS_FOR_CHART)
    data = []
    for row in rows:
        try:
            x = float(row.get(x_col, ""))
            y = float(row.get(y_col, ""))
            sz = float(row.get(size_col, ""))
            data.append({x_col: x, y_col: y, size_col: sz})
        except (ValueError, TypeError):
            continue
    return data


def _generate_correlation_data(dataset: Dataset, chart: dict) -> list[dict[str, Any]]:
    cols = chart.get("columns", [])
    matrix = []
    for col_a in cols:
        a_vals = dataset.get_numeric_column(col_a)
        for col_b in cols:
            b_vals = dataset.get_numeric_column(col_b)
            if not a_vals or not b_vals:
                corr = 0.0
            else:
                min_len = min(len(a_vals), len(b_vals))
                a_arr = np.array(a_vals[:min_len])
                b_arr = np.array(b_vals[:min_len])
                if np.std(a_arr) == 0 or np.std(b_arr) == 0:
                    corr = 0.0
                else:
                    corr = float(np.corrcoef(a_arr, b_arr)[0, 1])
            matrix.append({"x": col_a, "y": col_b, "value": round(corr, 4)})
    return matrix


def _generate_chart_data(dataset: Dataset, chart: dict) -> list[dict[str, Any]]:
    t = chart.get("type", "")
    if t in ("bar", "line", "scatter", "area", "combo"):
        return _generate_xy_data(dataset, chart)
    if t == "pie":
        return _generate_pie_data(dataset, chart)
    if t == "histogram":
        return _generate_histogram_data(dataset, chart)
    if t == "boxplot":
        return _generate_boxplot_data(dataset, chart)
    if t == "bubble":
        return _generate_bubble_data(dataset, chart)
    if t == "correlation":
        return _generate_correlation_data(dataset, chart)
    return []


# ---------------------------------------------------------------------------
# Main orchestration
# ---------------------------------------------------------------------------

async def process_analysis(dataset: Dataset, prompt: str) -> AnalyzeResponse:
    ctx = _build_dataset_context(dataset)

    # Step 1: text insights
    insights = await gemini.analyze(ctx, prompt)

    # Step 2: chart generation with retries
    charts: list[ChartConfig] = []
    chart_status = "not_feasible"
    chart_message = ""
    retry_attempts = 0

    for attempt in range(_MAX_RETRIES):
        retry_attempts = attempt + 1
        try:
            raw_charts = await gemini.generate_charts(ctx, prompt, insights)
            valid_charts = []
            for rc in raw_charts:
                if not isinstance(rc, dict):
                    continue
                if not _validate_chart(rc, dataset):
                    logger.warning("Invalid chart config skipped: %s", rc)
                    continue
                rc["data"] = _generate_chart_data(dataset, rc)
                valid_charts.append(ChartConfig(**rc))

            if valid_charts:
                charts = valid_charts
                chart_status = "success" if len(valid_charts) == len(raw_charts) else "partial"
                chart_message = (
                    "Charts generated successfully."
                    if chart_status == "success"
                    else f"{len(valid_charts)} of {len(raw_charts)} charts were valid."
                )
                break
            else:
                chart_message = f"Attempt {retry_attempts}: no valid charts returned."
        except Exception as exc:
            chart_message = f"Attempt {retry_attempts} failed: {exc}"
            logger.warning("Chart generation attempt %d failed: %s", retry_attempts, exc)

    if not charts:
        chart_status = "failed"
        if not chart_message:
            chart_message = "Chart generation failed after all retries."

    return AnalyzeResponse(
        **{
            "insights": insights,
            "charts": charts,
            "chartStatus": chart_status,
            "chartMessage": chart_message,
            "retryAttempts": retry_attempts,
        }
    )
