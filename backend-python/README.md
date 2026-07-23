# Agentic Data Analyzer — Python FastAPI Backend

A Python rewrite of the Go backend, exposing identical REST endpoints and business logic using **FastAPI**, **pandas/numpy** for data processing, and **Google Vertex AI (Gemini)** for AI-powered analysis.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Folder Structure](#folder-structure)
3. [Module-by-Module Breakdown](#module-by-module-breakdown)
   - [main.py](#mainpy)
   - [models/](#models)
   - [services/](#services)
   - [handlers/](#handlers)
   - [middleware/](#middleware)
   - [utils/](#utils)
4. [API Endpoints](#api-endpoints)
5. [Data Flow](#data-flow)
6. [Environment Variables](#environment-variables)
7. [Running Locally](#running-locally)
8. [Running with Docker](#running-with-docker)
9. [Running with the React Frontend](#running-with-the-react-frontend)
10. [Tech Stack](#tech-stack)

---

## Architecture Overview

```
React Frontend (port 5173)
        │
        │  HTTP/JSON
        ▼
FastAPI Server (port 3001)
        │
   ┌────┴────────────────────┐
   │                         │
Handlers                FileStorage
(upload, analyze,       (in-memory,
 suggestions)            thread-safe)
   │                         │
   │                         │
Services                  Dataset
(Gemini, Analysis          (pandas +
 Engine)                   numpy)
   │
   │  HTTPS / REST
   ▼
Google Vertex AI
(Gemini 2.5 Flash)
```

The server follows a **layered architecture**:

| Layer | Responsibility |
|---|---|
| **Handlers** | Parse HTTP request, validate input, call services, return HTTP response |
| **Services** | Business logic — AI calls, chart generation, file storage |
| **Models** | Data shapes — Pydantic schemas (API) and dataset parsing (files) |
| **Middleware** | Cross-cutting concerns — logging, request ID injection |
| **Utils** | Shared helpers — error types, response formatting, input validation |

---

## Folder Structure

```
backend-python/
├── main.py                          # App entry point
├── requirements.txt                 # Python dependencies
├── Dockerfile                       # Container build
├── .env.example                     # Environment variable template
│
├── handlers/                        # HTTP route handlers
│   ├── upload.py                    # POST /upload
│   ├── suggestions.py               # POST /suggestions
│   ├── contextual_suggestions.py    # POST /contextual-suggestions
│   └── analyze.py                   # POST /analyze
│
├── middleware/                      # ASGI middleware
│   ├── logger.py                    # Request logging
│   └── request_id.py                # X-Request-ID tracking
│
├── models/                          # Data definitions
│   ├── api.py                       # Pydantic request/response schemas
│   └── dataset.py                   # File parsing + statistics
│
├── services/                        # Business logic
│   ├── file_storage.py              # In-memory dataset store
│   ├── gemini.py                    # Vertex AI / Gemini integration
│   └── analysis_engine.py          # Analysis orchestration + chart generation
│
└── utils/                           # Shared helpers
    ├── errors.py                    # Custom exception hierarchy
    ├── response.py                  # JSON response helpers
    └── validation.py                # Prompt + file validation
```

---

## Module-by-Module Breakdown

### `main.py`

The application entry point. Wires everything together.

**What it does:**
- Creates the `FastAPI` application instance
- Configures **CORS** using `CORS_ALLOWED_ORIGINS` env var (defaults to `http://localhost:5173`)
- Registers the two custom middlewares: `RequestIDMiddleware` then `LoggerMiddleware`
- Registers all four route handlers via `include_router`
- Adds a global `exception_handler` that catches any unhandled exception and returns a structured `500` JSON instead of crashing
- Exposes `GET /health` for health checks
- Starts `uvicorn` when run directly (`python main.py`)

**Port:** `3001` (Go backend uses `3000` — no conflict when both run simultaneously)

---

### `models/`

#### `models/api.py` — Pydantic Schemas

Defines all request and response shapes using [Pydantic v2](https://docs.pydantic.dev/). Every field uses `alias` so the JSON uses camelCase (`fileId`, `stdDev`) while Python code uses snake_case.

| Class | Direction | Purpose |
|---|---|---|
| `ColumnInfo` | In/Out | Column name + type (`"number"` or `"string"`) |
| `ColumnStats` | Out | min, max, mean, median, stdDev, uniqueCount, nullCount, totalCount |
| `UploadResponse` | Out | fileId, fileName, columns, summary |
| `SuggestionsRequest` | In | fileId + columns + summary |
| `SuggestionsResponse` | Out | List of suggestion strings |
| `ChatMessage` | In | role (`user`/`assistant`) + content string |
| `ContextualSuggestionsRequest` | In | fileId + recentChats list |
| `AnalyzeRequest` | In | fileId + prompt string |
| `ChartConfig` | Out | type, title, x/y/size/category/value/columns + data array |
| `AnalyzeResponse` | Out | insights, charts, chartStatus, chartMessage, retryAttempts |
| `ErrorResponse` | Out | error message, code, optional requestId |

#### `models/dataset.py` — File Parsing + Statistics

Handles reading uploaded files and computing per-column statistics.

| Function | What it does |
|---|---|
| `parse_file(file_name, content)` | Routes to CSV or Excel parser based on file extension |
| `_parse_csv(file_name, content)` | Decodes bytes, reads with `csv.DictReader`, builds Dataset |
| `_parse_excel(file_name, content)` | Reads with `pandas.read_excel` (openpyxl/xlrd engine), converts to row dicts |
| `_build_dataset(file_name, rows)` | Iterates columns, infers type, computes stats, returns `Dataset` |
| `_infer_type_and_stats(values)` | Tries to parse every value as float; if ≥80% succeed → `"number"`, else `"string"`. Returns `ColumnStats` |

**`Dataset` class methods:**

| Method | What it does |
|---|---|
| `get_column_data(col_name)` | Returns raw list of all values in that column |
| `get_numeric_column(col_name)` | Returns only float-parseable values (skips blanks/nulls) |
| `get_column_names()` | All column names |
| `get_numeric_column_names()` | Only columns typed as `"number"` |
| `get_string_column_names()` | Only columns typed as `"string"` |

**Statistics computed per numeric column:** min, max, mean, median, stdDev (sample, ddof=1), nullCount, totalCount

**Statistics computed per string column:** uniqueCount, nullCount, totalCount

---

### `services/`

#### `services/file_storage.py` — In-Memory Store

A thread-safe singleton that maps UUID → Dataset.

| Method | What it does |
|---|---|
| `save_file(file_name, content)` | Calls `parse_file`, stores result under a new UUID, returns `(file_id, dataset)` |
| `get_dataset(file_id)` | Returns the `Dataset` for that UUID, or `None` if not found |
| `delete(file_id)` | Removes dataset from memory |

The module exports a single `file_storage` instance shared across all requests. A `threading.Lock` protects all dictionary reads and writes.

> **Note:** Data lives only in RAM for the server's lifetime. Restarting the server clears all datasets. Users need to re-upload their file after a restart.

---

#### `services/gemini.py` — Vertex AI / Gemini Integration

Calls the Google Vertex AI REST API using Application Default Credentials (ADC).

**Internal helpers:**

| Function | What it does |
|---|---|
| `_get_endpoint()` | Builds the Vertex AI REST URL from `GOOGLE_CLOUD_PROJECT_ID` and `GOOGLE_CLOUD_LOCATION` |
| `_get_access_token()` | Gets a short-lived OAuth2 token via `google.auth.default()` + refresh |
| `_call_gemini(prompt)` | POSTs prompt to Vertex AI, returns the raw text response |
| `_extract_json(text)` | Strips markdown fences, finds the first `[` or `{`, parses JSON. Raises `ValueError` if no JSON found |

**Public functions (called by handlers and analysis engine):**

| Function | What it does |
|---|---|
| `get_suggestions(columns, summary)` | Sends column names + statistics to Gemini, asks for 5-6 business-relevant analysis suggestions. Returns `list[str]` |
| `get_contextual_suggestions(columns, summary, recent_chats)` | Sends last 6 chat messages to Gemini, asks for 4-6 follow-up questions. Returns `list[str]` |
| `analyze(dataset_context, prompt)` | Step 1 of analysis — asks Gemini for pure text insights about the data. Returns insight string |
| `generate_charts(dataset_context, prompt, insights)` | Step 2 of analysis — asks Gemini to produce 1-3 chart config objects (JSON). Returns `list[dict]` |

**Model used:** `gemini-2.5-flash-preview-04-17`

---

#### `services/analysis_engine.py` — Analysis Orchestration + Chart Generation

The core of the application. Orchestrates the two-step analysis and handles all chart data population.

**Orchestration:**

| Function | What it does |
|---|---|
| `process_analysis(dataset, prompt)` | Main entry point. Calls `gemini.analyze` for text insights, then calls `gemini.generate_charts` with retry logic (max 3 attempts). Validates each chart config against the actual dataset columns, populates chart data, returns `AnalyzeResponse` |
| `_build_dataset_context(dataset)` | Formats column names, types, row count, and statistics into a text block sent to Gemini |
| `_validate_chart(chart, dataset)` | Checks that all column references in a chart config actually exist in the dataset and have the correct type (e.g., histogram requires a numeric column) |

**Chart data generators** — one per chart type:

| Function | Chart Types | What it does |
|---|---|---|
| `_generate_xy_data` | `bar`, `line`, `scatter`, `area`, `combo` | Samples up to 500 rows, returns `[{x_col: val, y_col: float_val}, ...]` |
| `_generate_pie_data` | `pie` | Aggregates values by category (sums numeric values), returns top 10 categories |
| `_generate_histogram_data` | `histogram` | Computes `sqrt(n)` bins via `numpy.histogram`, returns bin ranges + counts |
| `_generate_boxplot_data` | `boxplot` | Computes Q1, median, Q3, IQR, whiskers, and outlier points |
| `_generate_bubble_data` | `bubble` | Samples up to 500 rows, returns `{x, y, size}` per row |
| `_generate_correlation_data` | `correlation` | Computes Pearson correlation for every column pair in the matrix |
| `_sample_rows` | (helper) | Downsamples large datasets by taking every Nth row |

**Chart status values returned in `AnalyzeResponse`:**

| Status | Meaning |
|---|---|
| `success` | All Gemini-generated charts passed validation |
| `partial` | Some charts were valid, some were rejected (bad column references) |
| `failed` | No valid charts after all retries |
| `not_feasible` | Gemini returned no chart suggestions for this prompt |

---

### `handlers/`

Each handler is a FastAPI `APIRouter` with a single route.

#### `handlers/upload.py` — `POST /upload`

1. Reads uploaded file bytes from multipart form
2. Calls `validate_upload` (size ≤ 10 MB, extension must be `.csv`/`.xlsx`/`.xls`)
3. Calls `file_storage.save_file` → parses file → stores dataset
4. Returns `UploadResponse` with `fileId`, column list, and per-column statistics

#### `handlers/suggestions.py` — `POST /suggestions`

1. Validates `fileId` exists in storage (404 if not)
2. Calls `gemini.get_suggestions` with dataset columns + summary
3. Returns `SuggestionsResponse` with list of suggestion strings

#### `handlers/contextual_suggestions.py` — `POST /contextual-suggestions`

1. Validates `fileId` exists in storage (404 if not)
2. Calls `gemini.get_contextual_suggestions` with columns, summary, and recent chat messages
3. Returns `SuggestionsResponse` with follow-up question strings

#### `handlers/analyze.py` — `POST /analyze`

1. Validates `prompt` (not empty, ≤ 2000 chars, must contain data-related keywords)
2. Validates `fileId` exists in storage (404 if not)
3. Calls `analysis_engine.process_analysis` → full two-step AI analysis
4. Returns `AnalyzeResponse` with insights text, chart configs + data, and status

---

### `middleware/`

#### `middleware/request_id.py` — `RequestIDMiddleware`

- Reads `X-Request-ID` header from the incoming request
- If absent, generates a new UUID
- Stores it in `request.state.request_id` so handlers can attach it to error responses
- Adds `X-Request-ID` header to every outgoing response for client-side tracing

#### `middleware/logger.py` — `LoggerMiddleware`

- Records the start time before passing the request to the next handler
- After the response is produced, logs: `METHOD /path STATUS_CODE duration_ms [requestId]`
- Uses `uvicorn.access` logger so output blends with uvicorn's own access log

---

### `utils/`

#### `utils/errors.py` — Custom Exception Hierarchy

```
AppError (base)
├── ValidationError  → 400 VALIDATION_ERROR
├── NotFoundError    → 404 NOT_FOUND
├── InternalError    → 500 INTERNAL_ERROR
└── ExternalError    → 502 EXTERNAL_ERROR
```

Each error carries `message`, `code` (string enum), and `status_code`.

#### `utils/response.py` — Response Helpers

| Function | What it does |
|---|---|
| `success(data, status_code=200)` | Serializes a Pydantic model or dict to `JSONResponse` with `by_alias=True` (outputs camelCase) |
| `error(message, code, request_id, status_code)` | Returns a structured error `JSONResponse` with optional `requestId` field |

#### `utils/validation.py` — Input Validation

| Function | What it does |
|---|---|
| `validate_prompt(prompt)` | Checks prompt is non-empty, ≤ 2000 chars, and contains at least one data-related keyword (e.g., "compare", "trend", "correlation"). Returns error string or `None` |
| `validate_upload(filename, size)` | Checks file size ≤ 10 MB and extension is `.csv`, `.xlsx`, or `.xls`. Returns error string or `None` |

---

## API Endpoints

| Method | Path | Request Body | Response |
|---|---|---|---|
| `POST` | `/upload` | `multipart/form-data` with `file` field | `UploadResponse` |
| `POST` | `/suggestions` | `SuggestionsRequest` JSON | `SuggestionsResponse` |
| `POST` | `/contextual-suggestions` | `ContextualSuggestionsRequest` JSON | `SuggestionsResponse` |
| `POST` | `/analyze` | `AnalyzeRequest` JSON | `AnalyzeResponse` |
| `GET` | `/health` | — | `{"status": "ok"}` |

Interactive docs are auto-generated at `http://localhost:3001/docs` (Swagger UI) and `http://localhost:3001/redoc`.

---

## Data Flow

```
1. User uploads a CSV/Excel file
   POST /upload  →  file_storage.save_file()  →  dataset.parse_file()
                →  infer column types + compute stats
                →  store in memory under UUID
                →  return fileId + metadata

2. App requests initial suggestions
   POST /suggestions  →  gemini.get_suggestions(columns, stats)
                      →  returns 5-6 question strings

3. User submits an analysis prompt
   POST /analyze  →  validate_prompt()
                  →  file_storage.get_dataset(fileId)
                  →  analysis_engine.process_analysis()
                       Step 1: gemini.analyze()      → insights text
                       Step 2: gemini.generate_charts() → chart configs (retry ×3)
                               _validate_chart()     → reject bad column refs
                               _generate_chart_data() → populate data arrays
                  →  return AnalyzeResponse

4. App requests follow-up suggestions based on chat history
   POST /contextual-suggestions  →  gemini.get_contextual_suggestions(chats)
                                 →  returns 4-6 follow-up questions
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
# Required — your Google Cloud project ID
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project-id

# Optional — Vertex AI region (default: us-central1)
GOOGLE_CLOUD_LOCATION=us-central1

# Optional — path to service account JSON key
# Not needed if you have run: gcloud auth application-default login
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json

# Comma-separated list of allowed frontend origins
CORS_ALLOWED_ORIGINS=http://localhost:5173

# Server port (default: 3001)
PORT=3001

# development | production
ENVIRONMENT=development
```

### Google Cloud Authentication

**Option A — Local development (recommended):**
```bash
gcloud auth application-default login
```
This stores credentials in `~/.config/gcloud/` and they are picked up automatically.

**Option B — Service account key:**
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
```

---

## Running Locally

### Prerequisites

- Python 3.11 or 3.12
- pip
- A Google Cloud project with the **Vertex AI API** enabled

### Steps

**1. Clone the repo and enter the backend folder:**
```bash
cd "Agenetic Data Analyzer/backend-python"
```

**2. Create and activate a virtual environment:**
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python -m venv venv
source venv/bin/activate
```

**3. Install dependencies:**
```bash
pip install -r requirements.txt
```

**4. Set up environment variables:**
```bash
copy .env.example .env       # Windows
cp .env.example .env          # macOS/Linux
# Then edit .env with your GOOGLE_CLOUD_PROJECT_ID
```

**5. Authenticate with Google Cloud:**
```bash
gcloud auth application-default login
```

**6. Start the server:**
```bash
# Option A — dev mode with auto-reload
python main.py

# Option B — uvicorn directly
uvicorn main:app --reload --port 3001
```

The API is now available at `http://localhost:3001`.
Swagger docs: `http://localhost:3001/docs`

---

## Running with Docker

**Build the image:**
```bash
docker build -t agentic-analyzer-python .
```

**Run the container:**
```bash
docker run -p 3001:3001 \
  -e GOOGLE_CLOUD_PROJECT_ID=your-project-id \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/key.json \
  -v /path/to/key.json:/app/key.json \
  agentic-analyzer-python
```

---

## Running with the React Frontend

The frontend expects a backend at `http://localhost:3000` (the Go backend's port) by default. To use the Python backend instead, point the frontend at port `3001`.

### Step 1 — Start the Python backend

```bash
cd backend-python
python main.py
# Listening on http://localhost:3001
```

### Step 2 — Configure the frontend API base URL

Open the frontend source and find where the API base URL is set (typically an `axios` base URL or a `.env` variable). Change it to:

```
http://localhost:3001
```

If the frontend uses a `.env` file (Vite projects use `VITE_` prefix):
```env
# frontend/.env.local
VITE_API_BASE_URL=http://localhost:3001
```

### Step 3 — Start the React frontend

```bash
cd frontend
npm install
npm run dev
# Running on http://localhost:5173
```

### Step 4 — Open the app

Navigate to `http://localhost:5173`. The frontend will call the Python FastAPI backend at port `3001`.

### Running both Go and Python backends at the same time

Since Go runs on **port 3000** and Python runs on **port 3001**, both can run simultaneously with no conflicts. Simply toggle the frontend's base URL to switch between them:

| Backend | Port | Start command |
|---|---|---|
| Go (Fiber) | `3000` | `go run main.go` (from project root) |
| Python (FastAPI) | `3001` | `python main.py` (from `backend-python/`) |

---

## Tech Stack

| Concern | Go Backend | Python Backend |
|---|---|---|
| Framework | Fiber v2 | FastAPI |
| Server | Built-in | Uvicorn (ASGI) |
| Data processing | Custom Go structs | pandas + numpy |
| Excel parsing | excelize | openpyxl / xlrd |
| Validation | Manual | Pydantic v2 |
| AI / LLM | Vertex AI REST (manual) | Vertex AI REST (httpx + google-auth) |
| UUID | google/uuid | Python stdlib `uuid` |
| Port | 3000 | 3001 |
