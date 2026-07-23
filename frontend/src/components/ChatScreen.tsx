import { Box, Container, Stack, Typography } from '@mui/material'
import { useAppState } from '../context/AppContext'
import ChatHistory from './ChatHistory'
import ContextualSuggestions from './ContextualSuggestions'
import Suggestions from './Suggestions'
import PromptInput from './PromptInput'

export default function ChatScreen() {
  const { state } = useAppState()
  const hasMessages = state.chats.length > 0

  return (
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
    </Box>
  )
}
