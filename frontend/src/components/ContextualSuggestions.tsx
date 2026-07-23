import { useEffect, useState } from 'react'
import { Box, Chip, Collapse, IconButton, Skeleton, Stack, Tooltip, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { useAppState } from '../context/AppContext'
import { getContextualSuggestions } from '../api/backend'
import { normalizeError } from '../utils/errorMessage'

export default function ContextualSuggestions() {
  const { state } = useAppState()
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [isHidden, setIsHidden] = useState(false)

  useEffect(() => {
    if (state.chats.length > 0 && state.fileId) {
      loadContextualSuggestions()
    } else {
      setSuggestions([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.chats.length, state.fileId])

  const loadContextualSuggestions = async () => {
    if (!state.fileId || !state.schema) return

    setLoading(true)
    try {
      const contextualSuggestions = await getContextualSuggestions(state.fileId, state.chats.slice(-3))
      setSuggestions(contextualSuggestions)
    } catch (err) {
      normalizeError(err, 'Failed to load follow-up suggestions.')
      // Follow-up suggestions are a nicety, not critical — fail quietly.
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    window.dispatchEvent(new CustomEvent('suggestion-selected', { detail: suggestion }))
  }

  if (suggestions.length === 0 && !loading) return null

  if (isHidden) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
        <Chip
          size="small"
          icon={<VisibilityOutlinedIcon fontSize="small" />}
          label="Show suggestions"
          onClick={() => setIsHidden(false)}
          variant="outlined"
        />
      </Box>
    )
  }

  const visibleSuggestions = expanded ? suggestions : suggestions.slice(0, 3)

  return (
    <Box sx={{ width: '100%' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600} letterSpacing="0.04em">
          SUGGESTED QUESTIONS
        </Typography>
        <Stack direction="row" spacing={0.5}>
          {suggestions.length > 3 && (
            <IconButton size="small" onClick={() => setExpanded((e) => !e)} aria-label={expanded ? 'Show less' : 'Show more'}>
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          )}
          <Tooltip title="Hide suggestions">
            <IconButton size="small" onClick={() => setIsHidden(true)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {loading ? (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" width={140 + i * 30} height={32} />
          ))}
        </Stack>
      )
      : (
        <Collapse in>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {visibleSuggestions.map((suggestion, idx) => (
              <Chip
                key={idx}
                label={suggestion}
                variant="outlined"
                onClick={() => handleSuggestionClick(suggestion)}
                sx={{ maxWidth: '100%', height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.75 } }}
              />
            ))}
          </Stack>
        </Collapse>
      )}
    </Box>
  )
}
