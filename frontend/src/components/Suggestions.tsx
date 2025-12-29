import { useEffect, useState } from 'react'
import { useAppState } from '../context/AppContext'
import { getSuggestions } from '../api/backend'
import type { AppAction } from '../context/reducer'
import PromptInput from './PromptInput'

export default function Suggestions() {
  const { state, dispatch } = useAppState()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (state.schema && state.suggestions.length === 0) {
      loadSuggestions()
    }
  }, [state.schema])

  const loadSuggestions = async () => {
    if (!state.schema) return

    setLoading(true)
    setError(null)

    try {
      const suggestions = await getSuggestions(
        state.schema.fileId,
        state.schema.columns,
        state.schema.summary
      )
      dispatch({ type: 'SET_SUGGESTIONS', payload: suggestions } as AppAction)
    } catch (err: any) {
      // Enhanced error handling
      let errorMessage = 'Failed to load suggestions. Please try again.'
      
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error
      } else if (err.message) {
        errorMessage = err.message
      } else if (err.code === 'ERR_NETWORK') {
        errorMessage = 'Network error. Please check your connection.'
      }

      // Log error for debugging (only in development)
      if (import.meta.env.DEV) {
        console.error('Suggestions error:', {
          error: err,
          message: err.message,
          status: err.response?.status,
          requestId: err.requestId || err.response?.data?.requestId,
        })
      }

      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    // Trigger analysis with the suggestion
    const event = new CustomEvent('suggestion-selected', { detail: suggestion })
    window.dispatchEvent(event)
  }

  if (!state.schema) {
    return null
  }

  return (
    <div className="suggestions">
      <h2>Analysis Suggestions</h2>
      {loading && <div className="loading">Loading suggestions...</div>}
      {error && <div className="error-message">{error}</div>}
      {!loading && !error && state.suggestions.length > 0 && (
        <div className="suggestions-list">
          {state.suggestions.map((suggestion, idx) => (
            <div
              key={idx}
              className="suggestion-item"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

