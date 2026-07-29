import { Alert, Avatar, Box, Paper, Snackbar, Stack, Typography } from '@mui/material'
import { useState } from 'react'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { useAppState } from '../context/AppContext'
import ChartRenderer from './ChartRenderer'
import type { AppAction } from '../context/reducer'
import type { ChartConfig, ChatMessage } from '../types'

const CHART_STATUS_SEVERITY: Record<string, 'warning' | 'error' | 'info'> = {
  partial: 'warning',
  failed: 'error',
  not_feasible: 'info',
}

export default function ChatHistory() {
  const { state } = useAppState()
  const messages = state.chats

  if (messages.length === 0) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
        <Typography variant="body2" color="text.secondary" fontStyle="italic">
          No conversation yet — ask a question to get started.
        </Typography>
      </Box>
    )
  }

  return (
    <Stack spacing={3} sx={{ width: '100%' }}>
      {messages.map((message, idx) => (
        <MessageRow
          key={message.id}
          message={message}
          precedingPrompt={messages[idx - 1]?.role === 'user' ? messages[idx - 1].content : undefined}
        />
      ))}
    </Stack>
  )
}

function MessageContentLines({ content }: { content: string }) {
  return (
    <>
      {content.split('\n').map((line, idx) => {
        const trimmed = line.trim()
        if (trimmed.startsWith('*Note:') && trimmed.endsWith('*')) {
          return (
            <Typography key={idx} variant="caption" component="div" color="text.secondary" sx={{ fontStyle: 'italic', mt: 0.5 }}>
              {trimmed.replace(/^\*Note:\s*/, '').replace(/\*$/, '')}
            </Typography>
          )
        }
        return (
          <Typography key={idx} variant="body2" component="div" sx={{ minHeight: '1.2em' }}>
            {line}
          </Typography>
        )
      })}
    </>
  )
}

function MessageRow({ message, precedingPrompt }: { message: ChatMessage; precedingPrompt?: string }) {
  const { state, dispatch } = useAppState()
  const [pinnedNotice, setPinnedNotice] = useState(false)
  const isUser = message.role === 'user'
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const handlePin = (chart: ChartConfig) => {
    if (!state.activeThreadId) return
    dispatch({
      type: 'PIN_CHART',
      payload: { threadId: state.activeThreadId, chart, sourcePrompt: precedingPrompt },
    } as AppAction)
    setPinnedNotice(true)
  }

  if (isUser) {
    // User messages never carry charts, so a right-aligned, content-width
    // bubble is fine here and reads like a familiar chat UI.
    return (
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Stack spacing={0.5} alignItems="flex-end" sx={{ maxWidth: '78%' }}>
          <Typography variant="caption" color="text.secondary">
            You · {time}
          </Typography>
          <Paper
            variant="outlined"
            sx={{
              px: 2,
              py: 1.25,
              borderRadius: 3,
              borderTopRightRadius: 4,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              borderColor: 'primary.main',
            }}
          >
            <Typography variant="body2">{message.content}</Typography>
          </Paper>
        </Stack>
      </Box>
    )
  }

  // Assistant messages get a full-width content column (flex: 1, minWidth: 0)
  // rather than a shrink-wrapped bubble, so charts render at their real size
  // instead of collapsing against a content-sized ancestor.
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', width: '100%', minWidth: 0 }}>
      <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main', color: 'secondary.contrastText' }}>
        <AutoAwesomeIcon sx={{ fontSize: 18 }} />
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary">
          Orion · {time}
        </Typography>
        <Paper
          variant="outlined"
          sx={{ mt: 0.5, px: 2, py: 1.25, borderRadius: 3, borderTopLeftRadius: 4 }}
        >
          <MessageContentLines content={message.content} />
        </Paper>

        {message.charts && message.charts.length > 0 && (
          <Box sx={{ mt: 1.5, width: '100%', minWidth: 0 }}>
            <ChartRenderer charts={message.charts} onPin={handlePin} />
          </Box>
        )}

        {message.chartStatus && message.chartStatus !== 'success' && (
          <Alert severity={CHART_STATUS_SEVERITY[message.chartStatus] ?? 'info'} variant="outlined" sx={{ mt: 1.5 }}>
            {message.chartMessage || 'Chart generation encountered an issue.'}
          </Alert>
        )}
      </Box>

      <Snackbar
        open={pinnedNotice}
        autoHideDuration={2500}
        onClose={() => setPinnedNotice(false)}
        message="Pinned to dashboard"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}

