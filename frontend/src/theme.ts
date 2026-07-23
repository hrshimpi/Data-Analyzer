import { createTheme, type ThemeOptions } from '@mui/material/styles'
import type { PaletteMode } from '@mui/material'

const FONT_STACK = '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

const shape = { borderRadius: 10 }

const typography: ThemeOptions['typography'] = {
  fontFamily: FONT_STACK,
  h1: { fontWeight: 700 },
  h2: { fontWeight: 700 },
  h3: { fontWeight: 650 },
  h4: { fontWeight: 650 },
  h5: { fontWeight: 600 },
  h6: { fontWeight: 600 },
  button: { fontWeight: 600, textTransform: 'none' },
}

export function getTheme(mode: PaletteMode) {
  const isDark = mode === 'dark'

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? '#5B8DFF' : '#1A56DB',
        light: isDark ? '#8AAEFF' : '#4C7BEA',
        dark: isDark ? '#3A64C9' : '#123F9E',
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: '#F0A63A',
        light: '#F7C46B',
        dark: '#C6841F',
        contrastText: '#1B1608',
      },
      background: {
        default: isDark ? '#0B0E17' : '#F5F7FB',
        paper: isDark ? '#141A28' : '#FFFFFF',
      },
      divider: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(20,26,40,0.09)',
      success: { main: isDark ? '#5FBE83' : '#2E8B4F' },
      warning: { main: isDark ? '#E0B84C' : '#B8860B' },
      error: { main: isDark ? '#EC7469' : '#C13B2A' },
      text: {
        primary: isDark ? '#EAEEF6' : '#161B26',
        secondary: isDark ? '#9AA6B8' : '#5B6474',
      },
    },
    shape,
    typography,
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 8 },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 500 },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
    },
  })
}
