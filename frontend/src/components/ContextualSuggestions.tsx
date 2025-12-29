import { useState, useEffect } from 'react'
import { useAppState } from '../context/AppContext'
import { getContextualSuggestions } from '../api/backend'

export default function ContextualSuggestions() {
  const { state } = useAppState()
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [isHidden, setIsHidden] = useState(false)

  useEffect(() => {
    // Show contextual suggestions if there are chat messages
    if (state.chats.length > 0 && state.fileId) {
      loadContextualSuggestions()
    } else {
      setSuggestions([])
    }
  }, [state.chats.length, state.fileId])

  const loadContextualSuggestions = async () => {
    if (!state.fileId || !state.schema) return

    setLoading(true)
    try {
      const contextualSuggestions = await getContextualSuggestions(
        state.fileId,
        state.chats.slice(-3) // Last 3 messages for context
      )
      setSuggestions(contextualSuggestions)
    } catch (err: any) {
      // Enhanced error handling
      // @ts-ignore - Vite environment variable
      if (import.meta.env.DEV) {
        console.error('Failed to load contextual suggestions:', {
          error: err,
          message: err.message,
          status: err.response?.status,
          requestId: err.requestId || err.response?.data?.requestId,
        })
      }
      // Silently fail for suggestions - don't show error to user
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    const event = new CustomEvent('suggestion-selected', { detail: suggestion })
    window.dispatchEvent(event)
  }

  if (suggestions.length === 0 && !loading) {
    return null
  }

  if (isHidden) {
    return (
      <div className="contextual-suggestions hidden">
        <button
          className="show-suggestions-btn"
          onClick={() => setIsHidden(false)}
        >
          Show Suggestions
        </button>
      </div>
    )
  }

  const visibleSuggestions = expanded ? suggestions : suggestions.slice(0, 3)

  return (
    <div className="contextual-suggestions">
      <div className="contextual-suggestions-header">
        <span className="contextual-suggestions-title">Suggested Questions</span>
        <div className="suggestions-controls">
          {suggestions.length > 3 && (
            <button
              className="expand-suggestions-btn"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Show Less' : 'View More'}
            </button>
          )}
          <button
            className="hide-suggestions-btn"
            onClick={() => setIsHidden(true)}
            title="Hide suggestions"
          >
            ✕
          </button>
        </div>
      </div>
      {loading ? (
        <div className="loading">Loading suggestions...</div>
      ) : (
        <div className={`contextual-suggestions-list ${expanded ? 'expanded' : ''}`}>
          {visibleSuggestions.map((suggestion, idx) => (
            <div
              key={idx}
              className="contextual-suggestion-item"
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

