import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // react-grid-layout's react-draggable dependency reads process.env.NODE_ENV
  // for its own dev-mode warnings; Vite doesn't polyfill bare `process` like
  // webpack/CRA did, so without this it throws "process is not defined".
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
  },
  server: {
    port: 5173,
  },
})

