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
4. **Keep asking** — follow-up questions get contextual suggestions based on the conversation so far, and everything is organized into chat threads (multiple files/conversations, switchable from the sidebar). Threads and messages are persisted server-side in Postgres, tied to your authenticated account — not to a single browser.

## Features

- 📊 Upload Excel/CSV files (max 10 MB)
- 🤖 AI-powered data analysis suggestions
- 💬 Natural language Q&A about your data
- 📈 Interactive charts (bar, line, scatter, pie, area, combo, histogram, boxplot, bubble, correlation)
- 📌 **Pinnable dashboard canvas** — pin any generated chart out of the chat onto a persistent, drag-and-resize grid (built on `react-grid-layout`), so you can assemble your own dashboard instead of scrolling back through the conversation
- 🌓 Light/dark theme
- ☁️ Server-side persistence — chat threads and messages are stored in Postgres against your account, so the same conversations show up on any device/browser you log into; pinned dashboards currently remain per-browser (`localStorage`)

---

## Architecture

```
┌─────────────────────────┐        HTTP/JSON        ┌──────────────────────────┐
│   React + MUI Frontend  │ ───────────────────────▶ │   FastAPI Backend        │
│   (Vite, port 5173)     │ ◀─────────────────────── │   (Uvicorn, port 3001)   │
└─────────────────────────┘                          └───┬──────────┬──────────┬┘
                                                           │          │          │
                                              async httpx  │  asyncpg │  aioboto3│
                                                + OAuth2    │          │          │
                                                           ▼          ▼          ▼
                                          ┌──────────────────┐ ┌───────────┐ ┌───────────────┐
                                          │ Google Vertex AI │ │ Postgres  │ │ S3 / MinIO     │
                                          │ (Gemini 2.5      │ │ (+pgvector)│ │ (raw files)    │
                                          │  Flash)          │ │ dataset    │ │                │
                                          │                  │ │ metadata   │ │                │
                                          └──────────────────┘ └───────────┘ └───────────────┘
```

**Backend** — layered FastAPI app: `handlers/` (HTTP routes) → `services/` (Gemini integration, chart generation/orchestration, S3-backed file storage) → `models/` (Pydantic schemas, dataset parsing, and SQLAlchemy DB models) → `middleware/` + `utils/` (logging, request IDs, structured errors). Uploaded files are stored in S3 (MinIO locally); dataset metadata lives in Postgres — nothing is held in server memory between requests, so any backend instance can serve any request. All Gemini calls and DB/S3 access are fully async so concurrent requests don't block one another. See [`backend-python/README.md`](backend-python/README.md) for the full module-by-module breakdown and API reference.

**Frontend** — React 18 + TypeScript, Material UI v5 for the component/design system, Recharts for chart rendering, `react-grid-layout` for the pinnable dashboard canvas, `react-router-dom` for routing, `axios` for API calls. State lives in a single reducer-based context (`AppContext`/`reducer.ts`); the thread list and each thread's messages are fetched from the backend on demand rather than cached client-side. Pinned dashboards are the one piece of state still kept in `localStorage`, keyed per thread.

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
| Database | Postgres (+ `pgvector`) via SQLAlchemy 2.0 (async, `asyncpg`) + Alembic |
| Object storage | S3-compatible (MinIO locally, AWS S3 in the cloud) via `aioboto3` |
| AI / LLM | Google Vertex AI — Gemini (async `httpx` + `google-auth`) |
| Auth | AWS Cognito — JWT verification via `PyJWT` against cached JWKS |
| Validation | Pydantic v2 |

---

## Project structure

```
Agenetic Data Analyzer/
├── backend-python/          # FastAPI backend — see its own README for full details
│   ├── handlers/             # POST /upload, /suggestions, /contextual-suggestions, /analyze, threads.py, documents.py
│   ├── services/               # gemini.py, analysis_engine.py, storage_service.py (S3/MinIO),
│   │                             # dataset_service.py, thread_service.py, auth_service.py,
│   │                             # document_service.py, chunking_service.py (RAG ingestion)
│   ├── models/                   # Pydantic schemas + dataset parsing (models/), SQLAlchemy models (models/db/)
│   ├── alembic/                    # DB migrations
│   ├── middleware/                   # request ID + request logging
│   ├── utils/                          # error hierarchy, response helpers, input validation
│   ├── database.py                      # async engine/session
│   └── main.py                           # app entrypoint
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
- Docker (for local Postgres + MinIO)
- A Google Cloud project with the **Vertex AI API** enabled

### 1. Local infrastructure (Postgres + MinIO)

Uploaded files and dataset metadata are persisted in S3 and Postgres respectively — bring these up before the backend, since `/upload` needs both.

```bash
docker compose up -d
```

This starts:
- **Postgres** (`pgvector/pgvector:pg16`) on `localhost:5433` (not the Postgres default 5432 — deliberately avoids clashing with a native Postgres install you may already have running) — connect with `psql`, TablePlus, DBeaver, or any Postgres GUI client using the credentials in `docker-compose.yml` / `backend-python/.env.example` (`DATABASE_URL`).
- **MinIO** (S3-compatible object storage) — API on `localhost:9000`, web console on [`localhost:9001`](http://localhost:9001) (log in with the `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` values, defaults in `docker-compose.yml`).

Create the local bucket (`orion-datasets-local`) — either once by hand via the MinIO console, or automatically on every startup:

```bash
cp docker-compose.override.yml.example docker-compose.override.yml
docker compose up -d
```

Stop everything with `docker compose down` (add `-v` to also wipe the persisted volumes).

### 2. Database schema (SQLAlchemy + Alembic)

With Postgres running (previous step), apply the schema:

```bash
cd backend-python
python -m venv venv
venv\Scripts\activate                          # Windows
pip install -r requirements.txt
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

### 3. Backend

```bash
cd backend-python
venv\Scripts\activate        # Windows — skip if already active from step 2
# source venv/bin/activate   # macOS/Linux

copy .env.example .env      # Windows
# cp .env.example .env      # macOS/Linux
# then edit .env — set GOOGLE_CLOUD_PROJECT_ID (Postgres/S3/auth vars already default to local dev)

gcloud auth application-default login

python main.py               # listens on http://localhost:3001
```

Every endpoint except `/health` requires a Bearer token. `.env.example` defaults to `AUTH_MODE=local`, which accepts a single hardcoded dev token instead of real Cognito — see [Authentication](#authentication) below before deploying this anywhere shared.

### 4. Frontend

```bash
cd frontend
npm install

copy .env.example .env.local     # Windows — points VITE_API_URL at the backend
# cp .env.example .env.local     # macOS/Linux

npm run dev                       # listens on http://localhost:5173
```

Open `http://localhost:5173` in your browser.

Full backend details (Docker, data flow, module-by-module breakdown) are in [`backend-python/README.md`](backend-python/README.md).

---

## Authentication

Every endpoint except `GET /health` requires `Authorization: Bearer <token>`. Tokens are validated two different ways depending on `AUTH_MODE`:

**`AUTH_MODE=cognito`** (the real path) — the token must be a valid AWS Cognito **access** token (not an ID token) for the configured User Pool and App Client: signature verified against Cognito's public JWKS (fetched once, cached for an hour), plus `token_use`, `client_id`, and `iss` all checked explicitly. On first use, the token's `sub` claim is looked up in the `users` table and a row is created automatically if it doesn't exist yet — no separate signup step.

Setup:
1. In the AWS Console, create a Cognito **User Pool** and an **App Client** (public client, no secret — this is a browser app).
2. Set `COGNITO_USER_POOL_ID`, `COGNITO_APP_CLIENT_ID`, `COGNITO_REGION` in `backend-python/.env`.
3. Set `AUTH_MODE=cognito`.

**`AUTH_MODE=local`** (the default in `.env.example`) — for local development without a Cognito pool. Accepts one hardcoded token (`local-dev-token`) and maps every request to a single fixed test user, instead of verifying anything real.

> **Never set `AUTH_MODE=local` outside your own machine.** There is no real authentication in this mode — the token is a public, checked-into-this-repo string. Do not set it in any deployed or shared environment.

The frontend sends this same hardcoded token on every request (`VITE_DEV_AUTH_TOKEN` in `frontend/.env.local`) as a stand-in until a real login flow exists — it only works against a backend running with `AUTH_MODE=local`.

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
| `DATABASE_URL` | Yes | — | Postgres connection string (see [Local infrastructure](#1-local-infrastructure-postgres--minio)) |
| `S3_ENDPOINT_URL` | No | — | `http://localhost:9000` locally (MinIO); unset for real AWS |
| `S3_BUCKET_NAME` | Yes | — | `orion-datasets-local` locally |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | No | — | MinIO root user/password locally; omit in the cloud to use an IAM role instead |
| `AUTH_MODE` | No | `cognito` (code default) | `cognito` or `local` — see [Authentication](#authentication) |
| `COGNITO_USER_POOL_ID` / `COGNITO_APP_CLIENT_ID` / `COGNITO_REGION` | Required when `AUTH_MODE=cognito` | — | From your Cognito User Pool + App Client |

**`frontend/.env.local`**

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | No | `http://localhost:3001` | Backend base URL |
| `VITE_DEV_AUTH_TOKEN` | No | — | Sent as the Bearer token on every request; only works against a backend running `AUTH_MODE=local` |

---

## API overview

| Method | Path | Description |
|---|---|---|
| `POST` | `/upload` | Upload a CSV/Excel file, get back `fileId` + column schema + statistics |
| `POST` | `/suggestions` | Get initial AI-generated analysis suggestions for a dataset |
| `POST` | `/contextual-suggestions` | Get follow-up question suggestions based on chat history |
| `POST` | `/analyze` | Ask a question (optionally within an existing `threadId`); get back written insights + validated chart configs with data |
| `GET` | `/threads` | List the authenticated user's chat threads, most recently updated first |
| `GET` | `/threads/{id}/messages` | Get a thread's dataset schema + full message history |
| `POST` | `/threads` | Create a new (empty) thread for a dataset |
| `PATCH` | `/threads/{id}` | Rename a thread |
| `DELETE` | `/threads/{id}` | Delete a thread and its messages |
| `POST` | `/documents` | Upload a PDF/TXT/Markdown file for RAG ingestion (optionally scoped to a `datasetId`); chunking runs as a background task |
| `GET` | `/documents` | List the user's uploaded documents with status and chunk count |
| `GET` | `/documents/{id}/status` | Poll a document's ingestion status (`pending` → `ready`/`failed`) |
| `GET` | `/health` | Health check |

Interactive Swagger docs are available at `http://localhost:3001/docs` while the backend is running.

---

## License

MIT
