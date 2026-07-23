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
- 🌓 Light/dark theme
- 💾 Local browser persistence — multiple chat threads, switchable from the sidebar

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

**Frontend** — React 18 + TypeScript, Material UI v5 for the component/design system, Recharts for chart rendering, `react-router-dom` for routing, `axios` for API calls. State lives in a single reducer-based context (`AppContext`/`reducer.ts`) with chat threads persisted to `localStorage`.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + TypeScript + Vite |
| UI / design system | Material UI (MUI) v5, `@emotion` |
| Charts | Recharts |
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
        │                       # ChatHistory, ChartRenderer, Suggestions, ContextualSuggestions, ...
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

## Troubleshooting

**"No project ID could be determined" warning** — harmless; the app builds the Vertex AI endpoint from `GOOGLE_CLOUD_PROJECT_ID` directly, not from credential auto-detection. Silence it with `gcloud config set project YOUR_PROJECT_ID` if it bothers you.

**404 from the Gemini endpoint** — the configured `GEMINI_MODEL` isn't a valid published model ID for your project/region. Check available models in the Vertex AI Studio console, or leave `GEMINI_MODEL` unset to use the default.

**CORS errors** — make sure the frontend's actual origin (check the exact port Vite prints on startup) is listed in `CORS_ALLOWED_ORIGINS`.

**"Dataset not found" after a while** — the backend stores uploaded files in memory; restarting the server clears them. Re-upload the file.

---

## Known limitations

- **In-memory storage** — uploaded datasets live in the backend process's memory and are lost on restart; not suitable for multi-instance deployment as-is.
- **No authentication** — all endpoints are open; anyone with a `fileId` can query that dataset.
- **Single-user oriented** — chat history is stored in browser `localStorage`, not synced across devices or accounts.

These are known, tracked constraints for the current stage of the project rather than oversights.

## License

MIT
