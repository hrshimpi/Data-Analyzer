import { useState, useEffect, useRef } from 'react'
import { useAppState } from '../context/AppContext'
import { analyze } from '../api/backend'
import type { AppAction } from '../context/reducer'
import type { ChatMessage } from '../types'
import DataPreview from './DataPreview'

interface PromptInputProps {
  onSuggestionSelect?: (suggestion: string) => void
}

export default function PromptInput({}: PromptInputProps) {
  const { state, dispatch } = useAppState()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSchema, setShowSchema] = useState(false)
  const [hasMultipleLines, setHasMultipleLines] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Listen for suggestion selection
  useEffect(() => {
    const handleSuggestion = (e: CustomEvent) => {
      setPrompt(e.detail)
      // Auto-submit after a short delay
      setTimeout(() => {
        const form = document.querySelector('.prompt-input form') as HTMLFormElement
        if (form) {
          form.requestSubmit()
        }
      }, 100)
    }

    window.addEventListener('suggestion-selected', handleSuggestion as EventListener)
    return () => {
      window.removeEventListener('suggestion-selected', handleSuggestion as EventListener)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || !state.fileId || loading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    }

    // Add to current thread if exists, otherwise create new
    if (state.activeThreadId) {
      dispatch({ type: 'UPDATE_THREAD', payload: { threadId: state.activeThreadId, message: userMessage } } as AppAction)
    } else {
      dispatch({ type: 'ADD_CHAT', payload: userMessage } as AppAction)
    }
    
    setLoading(true)
    setError(null)
    const currentPrompt = prompt
    setPrompt('')
    setHasMultipleLines(false)
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      const response = await analyze(state.fileId, currentPrompt)

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.insights,
        charts: response.charts && response.charts.length > 0 ? response.charts : undefined,
        chartStatus: response.chartStatus,
        chartMessage: response.chartMessage,
        retryAttempts: response.retryAttempts,
        timestamp: Date.now(),
      }

      if (state.activeThreadId) {
        dispatch({ type: 'UPDATE_THREAD', payload: { threadId: state.activeThreadId, message: assistantMessage } } as AppAction)
      } else {
        dispatch({ type: 'ADD_CHAT', payload: assistantMessage } as AppAction)
      }
      if (response.charts && response.charts.length > 0) {
        dispatch({ type: 'SET_CHARTS', payload: response.charts } as AppAction)
      }
    } catch (err: any) {
      // Enhanced error handling
      let errorMessage = 'Failed to analyze your request. Please try again.'
      
      if (err.message) {
        errorMessage = err.message
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error
      }

      // Log error for debugging (only in development)
      // @ts-ignore - Vite environment variable
      if (import.meta.env.DEV) {
        console.error('Analysis error:', {
          error: err,
          message: err.message,
          status: err.status || err.response?.status,
          requestId: err.requestId || err.response?.data?.requestId,
        })
      }

      setError(errorMessage)
      
      const errorChatMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I encountered an error: ${errorMessage}${err.requestId ? ` (Request ID: ${err.requestId})` : ''}`,
        timestamp: Date.now(),
      }
      
      if (state.activeThreadId) {
        dispatch({ type: 'UPDATE_THREAD', payload: { threadId: state.activeThreadId, message: errorChatMessage } } as AppAction)
      } else {
        dispatch({ type: 'ADD_CHAT', payload: errorChatMessage } as AppAction)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="prompt-input-container">
      <form onSubmit={handleSubmit} className="prompt-input">
        <div className="input-group">
          <button
            type="button"
            onClick={() => setShowSchema(!showSchema)}
            className="schema-toggle-btn"
            title="Toggle Data Schema"
            disabled={!state.schema}
          >
            📊
          </button>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value)
              // Auto-resize textarea
              const textarea = e.target
              textarea.style.height = 'auto'
              const newHeight = Math.min(textarea.scrollHeight, 200)
              textarea.style.height = `${newHeight}px`
              
              // Check if content has multiple lines
              const lineCount = textarea.value.split('\n').length
              setHasMultipleLines(lineCount > 1 || textarea.scrollHeight > 60)
            }}
            onKeyDown={(e) => {
              // Allow Enter to submit if not Shift+Enter
              if (e.key === 'Enter' && !e.shiftKey && !loading && prompt.trim() && state.fileId) {
                e.preventDefault()
                const form = e.currentTarget.closest('form')
                if (form) {
                  form.requestSubmit()
                }
              }
            }}
            placeholder="Ask anything... (Press Shift+Enter for new line)"
            disabled={loading || !state.fileId}
            className={`prompt-field ${hasMultipleLines ? 'multi-line' : ''}`}
            rows={1}
          />
          <button
            type="submit"
            disabled={loading || !prompt.trim() || !state.fileId}
            className="submit-button"
            title="Send"
          >
            {loading ? '...' : '➤'}
          </button>
        </div>
        {error && <div className="error-message">{error}</div>}
      </form>
      {showSchema && state.schema && (
        <div className="schema-preview-section">
          <DataPreview />
        </div>
      )}
    </div>
  )
}
