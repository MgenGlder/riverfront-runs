// Live runner presence server.
//
// - Holds active runners in memory only (no database, nothing persisted).
// - Broadcasts the current runner list to all connected clients.
// - Drops a runner on disconnect, or after STALE_MS with no position update.
// - Serves the built static site from ../dist if present (single-host deploy);
//   in a split deploy (static on Netlify, this server on Fly) there's no dist
//   and it runs as a WebSocket-only service.
//
// Cross-origin / security notes (site and server on different domains):
// - WebSockets are NOT subject to CORS/preflight, so the browser will open a
//   cross-origin socket freely. The real protection is validating the `Origin`
//   header on the upgrade to block cross-site WebSocket hijacking (CSWSH).
//   Configure ALLOWED_ORIGINS with your site's origin(s).
// - HTTP responses (the /health check, etc.) get proper CORS headers so they
//   can be called cross-origin from the allowed site.
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

// Comma-separated allowlist of site origins permitted to connect, e.g.
//   ALLOWED_ORIGINS="https://riverfront-runs.netlify.app,http://localhost:5173"
// Empty/unset => allow any origin (fine for local dev / single-host same-origin).
// Browsers send the Origin header as scheme://host[:port] with NO trailing
// slash and NO path, so normalize allowlist entries the same way — this makes
// the config forgiving if someone pastes "https://site.app/" with a slash.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean)

function isOriginAllowed(origin) {
  if (ALLOWED_ORIGINS.length === 0) return true // no allowlist configured
  if (!origin) return false // allowlist set but request sent no Origin
  return ALLOWED_ORIGINS.includes(origin)
}

// ---- Runner state (in memory only) ----
const runners = new Map() // id -> { id, name, lat, lng, updated }
let nextId = 1

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

function applyCors(req, res) {
  const origin = req.headers.origin
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Max-Age', '86400')
  }
  // Vary on Origin regardless, so caches don't leak one origin's response to another.
  res.setHeader('Vary', 'Origin')
}

const server = http.createServer(async (req, res) => {
  applyCors(req, res)

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const urlPath = decodeURIComponent((req.url || '/').split('?')[0])

  // Health check (Fly.io / uptime monitors)
  if (urlPath === '/health' || urlPath === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', runners: runners.size }))
    return
  }

  // Split deploy: no built site here, just the live service.
  if (!existsSync(DIST)) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('Riverfront Run live server is up (WebSocket at /ws).')
    return
  }

  // Single-host deploy: serve the built site from ../dist.
  try {
    let filePath = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath)
    if (!filePath.startsWith(DIST)) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }
    if (!existsSync(filePath) || filePath.endsWith(path.sep)) {
      filePath = path.join(DIST, 'index.html') // SPA fallback
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
const wss = new WebSocketServer({
  server,
  path: '/ws',
  // Reject cross-site WebSocket hijacking: only allowed origins may connect.
  verifyClient: ({ origin }, cb) => {
    if (isOriginAllowed(origin)) return cb(true)
    console.warn(`Rejected WebSocket from disallowed origin: ${origin || '(none)'}`)
    cb(false, 403, 'Origin not allowed')
  },
})

// Great-circle distance between two lat/lng points, in meters.
function haversine(aLat, aLng, bLat, bLng) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

const PACE_WINDOW_MS = 60_000 // rolling window for "current" pace
const MIN_STEP_M = 4 // ignore GPS jitter / stationary heartbeats below this
const MAX_STEP_M = 250 // ignore single-fix teleport spikes above this

// Only fields the clients need (omit internal rolling samples).
function publicRunner(r) {
  return {
    id: r.id,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    updated: r.updated,
    distance: r.distance, // meters, cumulative
    startedAt: r.startedAt, // ms epoch of first fix
    paceSecPerKm: r.paceSecPerKm, // rolling pace, or null
  }
}

function broadcast() {
  const payload = JSON.stringify({
    type: 'runners',
    runners: [...runners.values()].map(publicRunner),
  })
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
      const now = Date.now()
      const prev = runners.get(id)

      const startedAt = prev?.startedAt || now
      let distance = prev?.distance || 0
      let samples = prev?.samples || []

      if (prev) {
        const step = haversine(prev.lat, prev.lng, lat, lng)
        // Add real movement only; drop jitter (heartbeats resend the same
        // point, step ~0) and implausible single-fix jumps.
        if (step >= MIN_STEP_M && step <= MAX_STEP_M) distance += step
      }

      // Rolling pace over the last PACE_WINDOW_MS of cumulative distance.
      samples = [...samples.filter((s) => now - s.t <= PACE_WINDOW_MS), { t: now, d: distance }]
      let paceSecPerKm = null
      if (samples.length >= 2) {
        const first = samples[0]
        const last = samples[samples.length - 1]
        const dMeters = last.d - first.d
        const dSec = (last.t - first.t) / 1000
        if (dMeters > 20 && dSec > 0) paceSecPerKm = (dSec / dMeters) * 1000
      }

      runners.set(id, { id, name, lat, lng, updated: now, distance, startedAt, samples, paceSecPerKm })
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
  console.log(
    ALLOWED_ORIGINS.length
      ? `Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`
      : 'Allowed origins: (any — set ALLOWED_ORIGINS to lock this down in production)',
  )
})
