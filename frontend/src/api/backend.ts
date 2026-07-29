import axios, { AxiosError, AxiosResponse } from 'axios'
import type { ChatMessage, ColumnInfo, DatasetSchema, SuggestionsResponse, SummaryStats, AnalyzeResponse, ThreadDetail, ThreadSummary } from '../types'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// TEMPORARY until a real login flow exists: a static token, only valid
// against a backend running with AUTH_MODE=local. Never points at a real
// Cognito-protected backend — see backend-python/.env.example.
const DEV_AUTH_TOKEN = import.meta.env.VITE_DEV_AUTH_TOKEN

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    ...(DEV_AUTH_TOKEN ? { Authorization: `Bearer ${DEV_AUTH_TOKEN}` } : {}),
  },
  timeout: 60000, // 60 seconds timeout
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add request timestamp
    config.metadata = { startTime: new Date() }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  (error: AxiosError) => {
    // Handle different error types
    if (error.code === 'ECONNABORTED') {
      // Timeout error
      return Promise.reject(new Error('Request timeout. Please try again.'))
    }

    if (error.code === 'ERR_NETWORK') {
      // Network error
      return Promise.reject(new Error('Network error. Please check your connection and try again.'))
    }

    if (error.response) {
      // Server responded with error status
      const status = error.response.status
      const data = error.response.data as any

      let message = 'An error occurred'
      
      if (data?.error) {
        message = data.error
      } else if (status === 400) {
        message = 'Invalid request. Please check your input.'
      } else if (status === 404) {
        message = 'Resource not found.'
      } else if (status === 500) {
        message = 'Server error. Please try again later.'
      } else if (status >= 500) {
        message = 'Server error. Please try again later.'
      }

      // Create enhanced error with request ID if available
      const enhancedError = new Error(message)
      ;(enhancedError as any).status = status
      ;(enhancedError as any).requestId = data?.requestId
      ;(enhancedError as any).type = data?.type
      
      return Promise.reject(enhancedError)
    }

    // Unknown error
    return Promise.reject(new Error('An unexpected error occurred. Please try again.'))
  }
)

// Extend AxiosRequestConfig to include metadata
declare module 'axios' {
  export interface AxiosRequestConfig {
    metadata?: {
      startTime: Date
    }
  }
}

export const uploadFile = async (file: File): Promise<DatasetSchema> => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await api.post<DatasetSchema>('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return response.data
}

export const getSuggestions = async (
  fileId: string,
  columns: DatasetSchema['columns'],
  summary: DatasetSchema['summary']
): Promise<string[]> => {
  const response = await api.post<SuggestionsResponse>('/suggestions', {
    fileId,
    columns,
    summary,
  })

  return response.data.suggestions
}

export const analyze = async (
  fileId: string,
  prompt: string,
  threadId?: string | null
): Promise<AnalyzeResponse> => {
  // /analyze can chain up to 4 sequential Gemini calls (insights + up to 3
  // chart-generation retries), which can exceed the default 60s timeout.
  const response = await api.post<AnalyzeResponse>(
    '/analyze',
    { fileId, prompt, threadId: threadId ?? undefined },
    { timeout: 150000 }
  )

  return response.data
}

export const getContextualSuggestions = async (
  fileId: string,
  recentChats: Array<{ role: string; content: string }>
): Promise<string[]> => {
  const response = await api.post<SuggestionsResponse>('/contextual-suggestions', {
    fileId,
    recentChats,
  })

  return response.data.suggestions
}

// ---------------------------------------------------------------------------
// Chat threads
// ---------------------------------------------------------------------------

interface RawMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  chartConfigs?: {
    charts?: ChatMessage['charts']
    chartStatus?: ChatMessage['chartStatus']
    chartMessage?: string
    retryAttempts?: number
  } | null
  createdAt: string
}

interface RawThreadDetail {
  threadId: string
  title: string
  datasetId: string
  fileName: string
  columns: ColumnInfo[]
  summary: Record<string, SummaryStats>
  messages: RawMessage[]
}

function mapMessage(raw: RawMessage): ChatMessage {
  return {
    id: raw.id,
    role: raw.role,
    content: raw.content,
    timestamp: new Date(raw.createdAt).getTime(),
    charts: raw.chartConfigs?.charts,
    chartStatus: raw.chartConfigs?.chartStatus,
    chartMessage: raw.chartConfigs?.chartMessage,
    retryAttempts: raw.chartConfigs?.retryAttempts,
  }
}

function mapThreadDetail(raw: RawThreadDetail): ThreadDetail {
  return {
    threadId: raw.threadId,
    title: raw.title,
    schema: {
      fileId: raw.datasetId,
      fileName: raw.fileName,
      columns: raw.columns,
      summary: raw.summary,
    },
    messages: raw.messages.map(mapMessage),
  }
}

export const listThreads = async (): Promise<ThreadSummary[]> => {
  const response = await api.get<{ threads: ThreadSummary[] }>('/threads')
  return response.data.threads
}

export const getThreadMessages = async (threadId: string): Promise<ThreadDetail> => {
  const response = await api.get<RawThreadDetail>(`/threads/${threadId}/messages`)
  return mapThreadDetail(response.data)
}

export const createThread = async (datasetId: string, title?: string): Promise<ThreadDetail> => {
  const response = await api.post<RawThreadDetail>('/threads', { datasetId, title })
  return mapThreadDetail(response.data)
}

export const renameThread = async (threadId: string, title: string): Promise<ThreadSummary> => {
  const response = await api.patch<ThreadSummary>(`/threads/${threadId}`, { title })
  return response.data
}

export const deleteThread = async (threadId: string): Promise<void> => {
  await api.delete(`/threads/${threadId}`)
}

