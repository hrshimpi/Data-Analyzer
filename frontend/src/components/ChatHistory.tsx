import { Alert, Avatar, Box, Paper, Stack, Typography } from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { useAppState } from '../context/AppContext'
import ChartRenderer from './ChartRenderer'
import type { ChatMessage } from '../types'

const CHART_STATUS_SEVERITY: Record<string, 'warning' | 'error' | 'info'> = {
  partial: 'warning',
  failed: 'error',
  not_feasible: 'info',
}

export default function ChatHistory() {
  const { state } = useAppState()

  const activeThread = state.activeThreadId ? state.chatThreads.find((t) => t.id === state.activeThreadId) : null
  const messages = activeThread?.messages || state.chats

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
      {messages.map((message) => (
        <MessageRow key={message.id} message={message} />
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

function MessageRow({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

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
            <ChartRenderer charts={message.charts} />
          </Box>
        )}

        {message.chartStatus && message.chartStatus !== 'success' && (
          <Alert severity={CHART_STATUS_SEVERITY[message.chartStatus] ?? 'info'} variant="outlined" sx={{ mt: 1.5 }}>
            {message.chartMessage || 'Chart generation encountered an issue.'}
          </Alert>
        )}
      </Box>
    </Box>
  )
}

