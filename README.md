# Orion Data Analyzer

An agentic, AI-powered data analysis tool: upload a CSV or Excel file, ask questions about it in plain English, and get back written insights plus auto-generated charts — no manual chart configuration, no query language.

Built with **FastAPI (Python)** on the backend and **React + TypeScript + Material UI** on the frontend, using **Google Gemini (Vertex AI)** for analysis and chart generation.

> **Note on history:** this project was originally prototyped with a Go backend. That version was retired in favor of the Python/FastAPI backend documented below, which is the one actively developed and deployed.

---

## What it does

1. **Upload** a CSV or Excel file (up to 10 MB). The backend parses it, infers column types, and computes per-column statistics (min/max/mean/median/std-dev for numeric columns, unique/null counts for string columns).
2. **Get suggestions** — Gemini reviews the dataset's schema and statistics and proposes several relevant analysis questions to start from.
3. **Ask a question** in natural language ("compare average revenue across regions", "show me the distribution of order sizes"). The backend:
   - asks Gemini for a written analysis of the data in the context of your question,
   - asks Gemini to propose 1–3 chart configurations that best visualize the answer,
   - validates every chart config against the actual dataset (rejecting hallucinated column names or type mismatches), retrying up to 3 times if needed,
   - computes the real chart data server-side (sampling, binning, correlation matrices, box-plot quartiles, etc.) and returns it alongside the written insight.
4. **Keep asking** — follow-up questions get contextual suggestions based on the conversation so far, and everything is organized into chat threads (multiple files/conversations, switchable from the sidebar, persisted in `localStorage`).

## Features

- 📊 Upload Excel/CSV files (max 10 MB)
- 🤖 AI-powered data analysis suggestions
- 💬 Natural language Q&A about your data
- 📈 Interactive charts (bar, line, scatter, pie, area, combo, histogram, boxplot, bubble, correlation)
- 📌 **Pinnable dashboard canvas** — pin any generated chart out of the chat onto a persistent, drag-and-resize grid (built on `react-grid-layout`), so you can assemble your own dashboard instead of scrolling back through the conversation
- 🌓 Light/dark theme
- 💾 Local browser persistence — multiple chat threads and pinned dashboards, switchable from the sidebar

---

## Architecture

```
┌─────────────────────────┐        HTTP/JSON        ┌──────────────────────────┐
│   React + MUI Frontend  │ ───────────────────────▶ │   FastAPI Backend        │
│   (Vite, port 5173)     │ ◀─────────────────────── │   (Uvicorn, port 3001)   │
└─────────────────────────┘                          └────────────┬─────────────┘
                                                                   │
                                                        async httpx + OAuth2
                                                                   │
                                                                   ▼
                                                     ┌──────────────────────────┐
                                                     │  Google Vertex AI        │
                                                     │  (Gemini 2.5 Flash)      │
                                                     └──────────────────────────┘
```

**Backend** — layered FastAPI app: `handlers/` (HTTP routes) → `services/` (Gemini integration, chart generation/orchestration, in-memory file storage) → `models/` (Pydantic schemas + dataset parsing) → `middleware/` + `utils/` (logging, request IDs, structured errors). All Gemini calls are fully async so concurrent requests don't block one another. See [`backend-python/README.md`](backend-python/README.md) for the full module-by-module breakdown and API reference.

**Frontend** — React 18 + TypeScript, Material UI v5 for the component/design system, Recharts for chart rendering, `react-grid-layout` for the pinnable dashboard canvas, `react-router-dom` for routing, `axios` for API calls. State lives in a single reducer-based context (`AppContext`/`reducer.ts`) with chat threads (including pinned dashboards) persisted to `localStorage`.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + TypeScript + Vite |
| UI / design system | Material UI (MUI) v5, `@emotion` |
| Charts | Recharts |
| Dashboard layout | `react-grid-layout` (drag/resize grid) |
| Backend framework | FastAPI (Python 3.11) + Uvicorn |
| Data processing | pandas, numpy |
| AI / LLM | Google Vertex AI — Gemini (async `httpx` + `google-auth`) |
| Validation | Pydantic v2 |

---

## Project structure

```
Agenetic Data Analyzer/
├── backend-python/          # FastAPI backend — see its own README for full details
│   ├── handlers/             # POST /upload, /suggestions, /contextual-suggestions, /analyze
│   ├── services/               # gemini.py (LLM calls), analysis_engine.py (orchestration + chart data), file_storage.py
│   ├── models/                   # Pydantic schemas + dataset parsing/statistics
│   ├── middleware/                 # request ID + request logging
│   ├── utils/                        # error hierarchy, response helpers, input validation
│   └── main.py                        # app entrypoint
│
└── frontend/                # React + MUI frontend
    └── src/
        ├── components/        # AppSidebar, AppShell, ChatScreen, FileUpload, PromptInput,
        │                       # ChatHistory, ChartRenderer, DashboardCanvas, Suggestions, ...
        ├── pages/               # Landing, Home, Dashboard
        ├── context/              # AppContext + reducer (app state), ColorModeContext (theme)
        ├── api/                    # backend.ts — typed axios client
        ├── utils/                   # errorMessage.ts — shared error normalization
        └── theme.ts                  # MUI theme (light/dark)
```

---

## Getting started

### Prerequisites

- Python 3.11 or 3.12
- Node.js 18+ and npm
- A Google Cloud project with the **Vertex AI API** enabled

### 1. Backend

```bash
cd backend-python
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt

copy .env.example .env      # Windows
# cp .env.example .env      # macOS/Linux
# then edit .env — set GOOGLE_CLOUD_PROJECT_ID

gcloud auth application-default login

python main.py               # listens on http://localhost:3001
```

### 2. Frontend

```bash
cd frontend
npm install

copy .env.example .env.local     # Windows — points VITE_API_URL at the backend
# cp .env.example .env.local     # macOS/Linux

npm run dev                       # listens on http://localhost:5173
```

Open `http://localhost:5173` in your browser.

Full backend details (Docker, data flow, module-by-module breakdown) are in [`backend-python/README.md`](backend-python/README.md).

### 3. Local infrastructure (Postgres + MinIO)

Not required for the core upload/analyze flow yet — this brings up Postgres (with the `pgvector` extension, for RAG work) and a local S3-compatible store (MinIO), so the app talks to the same kind of endpoints locally as it will in the cloud, just pointed at `localhost` instead of AWS.

```bash
docker compose up -d
```

This starts:
- **Postgres** (`pgvector/pgvector:pg16`) on `localhost:5433` (not the Postgres default 5432 — deliberately avoids clashing with a native Postgres install you may already have running) — connect with `psql`, TablePlus, DBeaver, or any Postgres GUI client using the credentials in `docker-compose.yml` / `backend-python/.env.example` (`DATABASE_URL`).
- **MinIO** (S3-compatible object storage) — API on `localhost:9000`, web console on [`localhost:9001`](http://localhost:9001) (log in with the `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` values, defaults in `docker-compose.yml`).

To auto-create the local bucket (`orion-datasets-local`) on startup:

```bash
cp docker-compose.override.yml.example docker-compose.override.yml
docker compose up -d
```

Stop everything with `docker compose down` (add `-v` to also wipe the persisted volumes).

### 4. Database schema (SQLAlchemy + Alembic)

With Postgres running (previous step), apply the schema:

```bash
cd backend-python
venv\Scripts\activate                          # Windows
alembic upgrade head                            # applies all migrations
```

Other common commands, run from `backend-python/`:

```bash
alembic revision --autogenerate -m "describe your change"   # generate a new migration after editing models/db/*.py
alembic upgrade head                                          # apply all pending migrations
alembic downgrade -1                                           # revert the most recent migration
alembic current                                                 # show the currently-applied revision
```

The schema lives in `models/db/` (`User`, `Dataset`, `ChatThread`, `Message`) — `Base.metadata` from there is what `alembic revision --autogenerate` diffs against.

---

## Environment variables

**`backend-python/.env`**

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_CLOUD_PROJECT_ID` | Yes | — | Your GCP project ID |
| `GOOGLE_CLOUD_LOCATION` | No | `us-central1` | Vertex AI region |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Vertex AI model ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | — | Path to a service-account key; not needed with `gcloud auth application-default login` |
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:5173` | Comma-separated allowed origins |
| `PORT` | No | `3001` | Server port |

**`frontend/.env.local`**

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | No | `http://localhost:3001` | Backend base URL |

---

## API overview

| Method | Path | Description |
|---|---|---|
| `POST` | `/upload` | Upload a CSV/Excel file, get back `fileId` + column schema + statistics |
| `POST` | `/suggestions` | Get initial AI-generated analysis suggestions for a dataset |
| `POST` | `/contextual-suggestions` | Get follow-up question suggestions based on chat history |
| `POST` | `/analyze` | Ask a question; get back written insights + validated chart configs with data |
| `GET` | `/health` | Health check |

Interactive Swagger docs are available at `http://localhost:3001/docs` while the backend is running.

---

## License

MIT
