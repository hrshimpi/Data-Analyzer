import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { ColorModeProvider } from './context/ColorModeContext'
import Landing from './pages/Landing'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import { useAppState } from './context/AppContext'
import { ErrorBoundary } from './components/ErrorBoundary'

function AppContent() {
  const { state } = useAppState()

  if (state.fileId) {
    return <Dashboard />
  }

  return <Home />
}

function App() {
  return (
    <ColorModeProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <AppProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/app" element={<AppContent />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </ColorModeProvider>
  )
}

export default App

