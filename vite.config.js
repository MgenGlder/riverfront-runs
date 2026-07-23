import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Set `base` to your repo name if deploying to GitHub Pages under a subpath,
  // e.g. base: '/riverfront-runs/'
  base: '/',
  server: {
    // Pin the dev port so it never silently drifts to 5174/5175 (which leaves
    // stale browser tabs pointing at a dead ws://localhost:5173). strictPort
    // makes `npm run dev` fail loudly if 5173 is already taken.
    port: 5173,
    strictPort: true,
    // Proxy the live-map WebSocket to the Node server during `npm run dev`,
    // so the browser can connect same-origin at ws://localhost:5173/ws
    proxy: {
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
})
