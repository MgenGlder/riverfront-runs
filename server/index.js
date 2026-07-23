// Live runner presence server.
//
// - Holds active runners in memory only (no database, nothing persisted).
// - Broadcasts the current runner list to all connected clients.
// - Drops a runner on disconnect, or after STALE_MS with no position update.
// - In production it also serves the built static site from ../dist, so the
//   whole thing (site + live map) runs as a single `node server/index.js`.
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, '..', 'dist')
const PORT = process.env.PORT || 3001
const STALE_MS = 30_000 // drop runners silent for 30s
const MAX_NAME = 24

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
}

// ---- Static file serving (production only; Vite serves the app in dev) ----
const server = http.createServer(async (req, res) => {
  if (!existsSync(DIST)) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('Riverfront Run live server is up. Run `npm run build` to serve the site here, or use `npm run dev` for local development.')
    return
  }
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
    let filePath = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath)
    // prevent path traversal outside dist
    if (!filePath.startsWith(DIST)) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }
    // SPA fallback: unknown paths serve index.html
    if (!existsSync(filePath) || filePath.endsWith(path.sep)) {
      filePath = path.join(DIST, 'index.html')
    }
    const data = await readFile(filePath)
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' })
    res.end(data)
  } catch {
    res.writeHead(500)
    res.end('Server error')
  }
})

// ---- Live runner presence over WebSocket ----
const wss = new WebSocketServer({ server, path: '/ws' })
const runners = new Map() // id -> { id, name, lat, lng, updated }
let nextId = 1

function broadcast() {
  const payload = JSON.stringify({ type: 'runners', runners: [...runners.values()] })
  for (const client of wss.clients) {
    if (client.readyState === 1 /* OPEN */) client.send(payload)
  }
}

wss.on('connection', (ws) => {
  const id = String(nextId++)
  ws.isAlive = true
  ws.on('pong', () => { ws.isAlive = true })
  ws.send(JSON.stringify({ type: 'welcome', id }))
  broadcast() // send the new client the current roster

  ws.on('message', (raw) => {
    let msg
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }
    if (msg.type === 'update') {
      const lat = Number(msg.lat)
      const lng = Number(msg.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      const name = String(msg.name || 'Runner').trim().slice(0, MAX_NAME) || 'Runner'
      runners.set(id, { id, name, lat, lng, updated: Date.now() })
      broadcast()
    } else if (msg.type === 'leave') {
      if (runners.delete(id)) broadcast()
    }
  })

  ws.on('close', () => {
    if (runners.delete(id)) broadcast()
  })
})

// Heartbeat: terminate dead sockets so they don't linger on the map.
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate()
      continue
    }
    ws.isAlive = false
    ws.ping()
  }
}, 15_000)

// Prune runners who stopped sending positions (closed laptop, lost signal, etc.)
const pruner = setInterval(() => {
  const now = Date.now()
  let changed = false
  for (const [id, r] of runners) {
    if (now - r.updated > STALE_MS) {
      runners.delete(id)
      changed = true
    }
  }
  if (changed) broadcast()
}, 10_000)

wss.on('close', () => {
  clearInterval(heartbeat)
  clearInterval(pruner)
})

server.listen(PORT, () => {
  console.log(`Riverfront Run server listening on http://localhost:${PORT}  (WebSocket at /ws)`)
})
