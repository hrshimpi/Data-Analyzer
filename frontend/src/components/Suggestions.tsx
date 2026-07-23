import { useEffect, useState } from 'react'
import { Alert, Box, Button, List, ListItemButton, ListItemIcon, ListItemText, Skeleton, Typography } from '@mui/material'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useAppState } from '../context/AppContext'
import { getSuggestions } from '../api/backend'
import type { AppAction } from '../context/reducer'
import { normalizeError } from '../utils/errorMessage'

export default function Suggestions() {
  const { state, dispatch } = useAppState()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (state.schema && state.suggestions.length === 0) {
      loadSuggestions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.schema])

  const loadSuggestions = async () => {
    if (!state.schema) return

    setLoading(true)
    setError(null)

    try {
      const suggestions = await getSuggestions(state.schema.fileId, state.schema.columns, state.schema.summary)
      dispatch({ type: 'SET_SUGGESTIONS', payload: suggestions } as AppAction)
    } catch (err) {
      setError(normalizeError(err, 'Failed to load suggestions.').message)
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    window.dispatchEvent(new CustomEvent('suggestion-selected', { detail: suggestion }))
  }

  if (!state.schema) return null

  return (
    <Box sx={{ width: '100%', maxWidth: 640, mx: 'auto' }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <LightbulbOutlinedIcon fontSize="small" />
        Suggested analyses
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={44} />
          ))}
        </Box>
      )}

      {!loading && error && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={loadSuggestions}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {!loading && !error && state.suggestions.length > 0 && (
        <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {state.suggestions.map((suggestion, idx) => (
            <ListItemButton
              key={idx}
              onClick={() => handleSuggestionClick(suggestion)}
              sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                <LightbulbOutlinedIcon fontSize="small" color="secondary" />
              </ListItemIcon>
              <ListItemText primary={suggestion} primaryTypographyProps={{ variant: 'body2' }} />
            </ListItemButton>
          ))}
        </List>
      )}
    </Box>
  )
}
