# Orion Data Analyzer

A single-user, no-auth, agentic AI web application for analyzing Excel/CSV data using Google Gemini (Vertex AI). Built with React.js + TypeScript (frontend) and Golang + Fiber (backend).

## Features

- 📊 Upload Excel/CSV files (max 10MB)
- 🤖 AI-powered data analysis suggestions
- 💬 Natural language Q&A about your data
- 📈 Interactive charts (bar, line, scatter, pie, area, combo, histogram, boxplot, bubble, correlation)
- 💾 Local browser persistence (chat threads stored locally)
- 🔄 Multi-chat/thread support

## Prerequisites

1. **Go 1.25+** - [Download](https://golang.org/dl/)
2. **Node.js 18+** and npm - [Download](https://nodejs.org/)
3. **Google Cloud Project** with Vertex AI enabled
4. **Google Cloud SDK** installed - [Download](https://cloud.google.com/sdk/docs/install)

## Quick Start

### 1. Google Cloud Authentication

```powershell
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

### 2. Set Environment Variables

```powershell
$env:GOOGLE_CLOUD_PROJECT_ID="your-google-cloud-project-id"
$env:GOOGLE_CLOUD_LOCATION="us-central1"
```

**Optional for production:**
```powershell
$env:CORS_ALLOWED_ORIGINS="https://yourdomain.com"
$env:ENVIRONMENT="production"
```

### 3. Install Dependencies

**Backend:**
```powershell
go mod tidy
```

**Frontend:**
```powershell
cd frontend
npm install
```

### 4. Run the Application

**Terminal 1 - Backend:**
```powershell
go run main.go
```

**Terminal 2 - Frontend:**
```powershell
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

## Environment Variables

### Backend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_CLOUD_PROJECT_ID` | Yes | - | Your Google Cloud Project ID |
| `GOOGLE_CLOUD_LOCATION` | No | `us-central1` | Vertex AI region |
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:5173,http://localhost:3000` | Comma-separated allowed origins |
| `ENVIRONMENT` | No | `development` | `development` or `production` |

### Frontend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | `http://localhost:3000` | Backend API URL |

## API Endpoints

- `POST /upload` - Upload CSV/Excel file
- `POST /suggestions` - Get AI-generated analysis suggestions
- `POST /contextual-suggestions` - Get follow-up questions based on chat history
- `POST /analyze` - Execute AI-driven analysis with charts
- `GET /health` - Health check

## Deployment

### Backend (Google Cloud Run)

```bash
docker build -t gcr.io/YOUR_PROJECT_ID/data-analyzer-backend .
docker push gcr.io/YOUR_PROJECT_ID/data-analyzer-backend
gcloud run deploy data-analyzer-backend \
  --image gcr.io/YOUR_PROJECT_ID/data-analyzer-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT_ID=YOUR_PROJECT_ID,ENVIRONMENT=production,CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

### Frontend

Deploy `frontend/dist` to any static hosting (Vercel, Netlify, etc.). Set `VITE_API_URL` to your backend URL.

## Troubleshooting

**"failed to find default credentials"**
- Run: `gcloud auth application-default login`

**"GOOGLE_CLOUD_PROJECT_ID environment variable is required"**
- Set: `$env:GOOGLE_CLOUD_PROJECT_ID="your-project-id"`

**"Publisher Model was not found"**
- Verify model version: `gcloud ai models list`
- Check Vertex AI API is enabled

**CORS Error**
- Add your frontend origin to `CORS_ALLOWED_ORIGINS`
- Example: `CORS_ALLOWED_ORIGINS=https://yourdomain.com`

## Project Structure

```
├── main.go                      # Backend entry point
├── backend/
│   ├── handlers/               # API handlers
│   ├── services/               # Business logic
│   ├── models/                 # Data models
│   ├── utils/                  # Utilities
│   └── middleware/             # HTTP middleware
├── frontend/
│   ├── src/
│   │   ├── pages/              # Page components
│   │   ├── components/         # React components
│   │   ├── context/            # State management
│   │   ├── api/                # API client
│   │   └── styles/             # CSS files
│   └── package.json
└── storage/temp/               # Temporary file storage
```

## Notes

- No authentication required (single-user app)
- Chat threads stored in browser localStorage (24-hour expiry)
- File size limit: 10MB
- Supported formats: CSV, XLSX, XLS
- Two-step agent flow: Analysis (reasoning) → Chart Generator (strict JSON)
- Retry mechanism: Up to 3 attempts with corrective prompts
- Graceful fallback: Text insights provided even when charts fail

## License

MIT
