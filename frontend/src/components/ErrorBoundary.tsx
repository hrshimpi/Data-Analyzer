import { Component, ErrorInfo, ReactNode } from 'react'
import { Alert, Box, Button, Container, Paper, Stack, Typography } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import ReplayIcon from '@mui/icons-material/Replay'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }
    this.setState({ error, errorInfo })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: 'background.default' }}>
          <Container maxWidth="sm">
            <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }}>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                Something went wrong
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                An unexpected error occurred while rendering the app. You can try again, or reload the page if the
                problem persists.
              </Typography>

              {import.meta.env.DEV && this.state.error && (
                <Alert severity="error" variant="outlined" sx={{ mb: 3, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12 }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </Alert>
              )}

              <Stack direction="row" spacing={1.5}>
                <Button variant="contained" startIcon={<ReplayIcon />} onClick={this.handleReset}>
                  Try again
                </Button>
                <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => window.location.reload()}>
                  Reload page
                </Button>
              </Stack>
            </Paper>
          </Container>
        </Box>
      )
    }

    return this.props.children
  }
}
