import { Box, Container, Stack, Typography } from '@mui/material'
import { useAppState } from '../context/AppContext'
import FileUpload from '../components/FileUpload'
import ChatScreen from '../components/ChatScreen'
import AppShell from '../components/AppShell'

export default function Home() {
  const { state } = useAppState()
  const hasFile = !!state.fileId

  return (
    <AppShell>
      {hasFile ? (
        <ChatScreen />
      ) : (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
          <Container maxWidth="sm">
            <Stack spacing={3} alignItems="center" textAlign="center">
              <Stack spacing={0.5}>
                <Typography variant="h5" fontWeight={700}>
                  Hi, this is Orion
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Please upload your file here
                </Typography>
              </Stack>
              <FileUpload />
            </Stack>
          </Container>
        </Box>
      )}
    </AppShell>
  )
}
