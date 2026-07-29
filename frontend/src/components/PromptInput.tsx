import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Collapse, IconButton, Paper, TextField, Tooltip, CircularProgress } from '@mui/material'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined'
import { useAppState } from '../context/AppContext'
import { analyze } from '../api/backend'
import type { AppAction } from '../context/reducer'
import type { ChatMessage } from '../types'
import { normalizeError } from '../utils/errorMessage'
import DataPreview from './DataPreview'

export default function PromptInput() {
  const { state, dispatch } = useAppState()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [datasetMissing, setDatasetMissing] = useState(false)
  const [showSchema, setShowSchema] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const handleSuggestion = (e: CustomEvent) => {
      setPrompt(e.detail)
      setTimeout(() => formRef.current?.requestSubmit(), 100)
    }
    window.addEventListener('suggestion-selected', handleSuggestion as EventListener)
    return () => window.removeEventListener('suggestion-selected', handleSuggestion as EventListener)
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
    dispatch({ type: 'ADD_MESSAGE', payload: userMessage } as AppAction)

    setLoading(true)
    setError(null)
    setDatasetMissing(false)
    const currentPrompt = prompt
    setPrompt('')

    try {
      const response = await analyze(state.fileId, currentPrompt, state.activeThreadId)

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
      dispatch({ type: 'ADD_MESSAGE', payload: assistantMessage } as AppAction)

      // The backend may have just auto-created the thread (first question
      // in a session) or renamed it (first message in an existing thread) —
      // either way, keep the sidebar list in sync with what actually
      // happened server-side rather than assuming.
      dispatch({
        type: 'UPSERT_THREAD',
        payload: {
          id: response.threadId,
          title: response.title,
          datasetId: state.fileId,
          updatedAt: new Date().toISOString(),
        },
      } as AppAction)
    } catch (err) {
      const normalized = normalizeError(err, 'Failed to analyze your request. Please try again.')
      setError(normalized.message)
      setDatasetMissing(normalized.status === 404)

      const errorChatMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I ran into a problem: ${normalized.message}${normalized.requestId ? ` (Request ID: ${normalized.requestId})` : ''}`,
        timestamp: Date.now(),
      }
      dispatch({ type: 'ADD_MESSAGE', payload: errorChatMessage } as AppAction)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ width: '100%' }}>
      {error && (
        <Alert severity={datasetMissing ? 'warning' : 'error'} sx={{ mb: 1.5 }} onClose={() => setError(null)}>
          {datasetMissing ? 'This dataset is no longer available — please re-upload your file to continue.' : error}
        </Alert>
      )}

      <Collapse in={showSchema && !!state.schema}>
        <Box sx={{ mb: 1.5 }}>
          <DataPreview />
        </Box>
      </Collapse>

      <Paper
        component="form"
        ref={formRef}
        onSubmit={handleSubmit}
        variant="outlined"
        sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, p: 1, borderRadius: 3 }}
      >
        <Tooltip title="Toggle dataset schema">
          <span>
            <IconButton
              type="button"
              size="small"
              onClick={() => setShowSchema((s) => !s)}
              disabled={!state.schema}
              color={showSchema ? 'primary' : 'default'}
            >
              <TableChartOutlinedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <TextField
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !loading && prompt.trim() && state.fileId) {
              e.preventDefault()
              formRef.current?.requestSubmit()
            }
          }}
          placeholder="Ask anything about your data… (Shift+Enter for a new line)"
          disabled={loading || !state.fileId}
          multiline
          minRows={1}
          maxRows={6}
          fullWidth
          variant="standard"
          InputProps={{ disableUnderline: true }}
          sx={{ px: 1 }}
        />

        <Tooltip title="Send">
          <span>
            <IconButton type="submit" color="primary" disabled={loading || !prompt.trim() || !state.fileId}>
              {loading ? <CircularProgress size={20} /> : <SendRoundedIcon />}
            </IconButton>
          </span>
        </Tooltip>
      </Paper>
    </Box>
  )
}
