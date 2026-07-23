import { Box } from '@mui/material'
import type { ReactNode } from 'react'
import AppSidebar from './AppSidebar'

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default' }}>
      <AppSidebar />
      <Box component="main" sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </Box>
    </Box>
  )
}
