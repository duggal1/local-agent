import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ws': { target: 'http://127.0.0.1:8000', ws: true, timeout: 0, proxyTimeout: 0 },
      '/api': { target: 'http://127.0.0.1:8000', timeout: 0, proxyTimeout: 0 },
      '/health': 'http://127.0.0.1:8000',
      '/api/files': { target: 'http://127.0.0.1:8000', timeout: 0, proxyTimeout: 0 },
    },
  },
})