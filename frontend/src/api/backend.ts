import axios, { AxiosError, AxiosResponse } from 'axios'
import type { DatasetSchema, SuggestionsResponse, AnalyzeResponse } from '../types'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
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
  prompt: string
): Promise<AnalyzeResponse> => {
  const response = await api.post<AnalyzeResponse>('/analyze', {
    fileId,
    prompt,
  })

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

