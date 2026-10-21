import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Shared synthetic dataset at the repository root (also used by the backend).
      '@data': fileURLToPath(new URL('../data', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Allow serving the shared dataset from outside the frontend folder.
    fs: { allow: ['..'] },
    proxy: {
      // Forward API calls to the FastAPI mock backend during development.
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
