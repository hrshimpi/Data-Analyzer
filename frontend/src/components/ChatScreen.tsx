import { useState } from 'react'
import { Badge, Box, Container, Stack, Tab, Tabs, Typography } from '@mui/material'
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined'
import DashboardCustomizeOutlinedIcon from '@mui/icons-material/DashboardCustomizeOutlined'
import { useAppState } from '../context/AppContext'
import ChatHistory from './ChatHistory'
import ContextualSuggestions from './ContextualSuggestions'
import Suggestions from './Suggestions'
import PromptInput from './PromptInput'
import DashboardCanvas from './DashboardCanvas'

type View = 'chat' | 'dashboard'

export default function ChatScreen() {
  const { state } = useAppState()
  const hasMessages = state.chats.length > 0
  const [view, setView] = useState<View>('chat')

  const activeThread = state.activeThreadId ? state.chatThreads.find((t) => t.id === state.activeThreadId) : null
  const pinnedCount = activeThread?.pinnedCharts?.length ?? 0

  return (
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ px: { xs: 2, md: 4 }, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tabs value={view} onChange={(_, v) => setView(v)} sx={{ minHeight: 44 }}>
          <Tab
            value="chat"
            label="Chat"
            icon={<ForumOutlinedIcon fontSize="small" />}
            iconPosition="start"
            sx={{ minHeight: 44 }}
          />
          <Tab
            value="dashboard"
            sx={{ minHeight: 44 }}
            iconPosition="start"
            icon={<DashboardCustomizeOutlinedIcon fontSize="small" />}
            label={
              <Badge badgeContent={pinnedCount} color="secondary" sx={{ '& .MuiBadge-badge': { right: -10 } }}>
                <Box sx={{ pr: pinnedCount > 0 ? 1 : 0 }}>Dashboard</Box>
              </Badge>
            }
          />
        </Tabs>
      </Box>

      {view === 'chat' ? (
        <>
          <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, md: 4 }, py: 3 }}>
            <Container maxWidth="md" disableGutters sx={{ display: 'flex', flexDirection: 'column', gap: 3, minHeight: '100%' }}>
              {!hasMessages && (
                <Stack spacing={0.5} sx={{ textAlign: 'center', pt: 4, pb: 1 }}>
                  <Typography variant="h5" fontWeight={700}>
                    Hi, this is Orion
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Ask anything about your data
                  </Typography>
                </Stack>
              )}

              <ChatHistory />
              {hasMessages && <ContextualSuggestions />}
              {!hasMessages && <Suggestions />}
            </Container>
          </Box>

          <Box sx={{ px: { xs: 2, md: 4 }, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Container maxWidth="md" disableGutters>
              <PromptInput />
            </Container>
          </Box>
        </>
      ) : (
        <DashboardCanvas />
      )}
    </Box>
  )
}
