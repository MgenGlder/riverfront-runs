import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MAP } from '../config.js'
import routeGeo from '../route.json'

const ROUTE_COLOR = '#1f6fb8'

// Pull the first LineString out of a GeoJSON FeatureCollection / Feature /
// geometry, and convert GeoJSON [lng, lat] pairs to Leaflet [lat, lng].
function routeLatLngs(geo) {
  const geoms = []
  if (geo?.type === 'FeatureCollection') geo.features?.forEach((f) => geoms.push(f?.geometry))
  else if (geo?.type === 'Feature') geoms.push(geo.geometry)
  else geoms.push(geo)
  const line = geoms.find((g) => g?.type === 'LineString' && g.coordinates?.length > 1)
  return line ? line.coordinates.map(([lng, lat]) => [lat, lng]) : null
}

// Parse GPX track/route/waypoints (already in [lat, lon]) into Leaflet points.
function gpxLatLngs(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) return null
  let nodes = [...doc.querySelectorAll('trkpt, rtept')]
  if (nodes.length < 2) nodes = [...doc.querySelectorAll('wpt')]
  const pts = nodes
    .map((p) => [parseFloat(p.getAttribute('lat')), parseFloat(p.getAttribute('lon'))])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))
  return pts.length > 1 ? pts : null
}

// Optional: drop a GPX file at src/route.gpx and it takes priority over the
// GeoJSON. import.meta.glob loads it if present, and yields {} if it isn't.
const gpxRaw = Object.values(
  import.meta.glob('../route.gpx', { query: '?raw', import: 'default', eager: true }),
)[0]

const ROUTE = (gpxRaw && gpxLatLngs(gpxRaw)) || routeLatLngs(routeGeo)

// --- Route metrics: project a position onto the route to get progress /
// remaining distance, so it still works when a runner drifts off the line. ---
function buildRouteMetrics(latlngs) {
  if (!latlngs || latlngs.length < 2) return null
  const [lat0, lng0] = latlngs[0]
  const mPerLat = 110540
  const mPerLng = 111320 * Math.cos((lat0 * Math.PI) / 180)
  const xy = latlngs.map(([lat, lng]) => [(lng - lng0) * mPerLng, (lat - lat0) * mPerLat])
  const cum = [0]
  for (let i = 1; i < xy.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]))
  }
  return { xy, cum, total: cum[cum.length - 1], lat0, lng0, mPerLat, mPerLng }
}
const ROUTE_METRICS = buildRouteMetrics(ROUTE)

function routeProgress(pos) {
  const m = ROUTE_METRICS
  if (!m || !pos) return null
  const px = (pos.lng - m.lng0) * m.mPerLng
  const py = (pos.lat - m.lat0) * m.mPerLat
  let best = { off: Infinity, along: 0 }
  for (let i = 1; i < m.xy.length; i++) {
    const [ax, ay] = m.xy[i - 1]
    const [bx, by] = m.xy[i]
    const dx = bx - ax
    const dy = by - ay
    const segLen2 = dx * dx + dy * dy
    let t = segLen2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / segLen2 : 0
    t = Math.max(0, Math.min(1, t))
    const off = Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
    if (off < best.off) best = { off, along: m.cum[i - 1] + t * Math.sqrt(segLen2) }
  }
  return { along: best.along, off: best.off, remaining: Math.max(0, m.total - best.along), total: m.total }
}

// --- Formatting (US units: miles + min/mi) ---
const M_PER_MI = 1609.344
const fmtDist = (m) => `${(m / M_PER_MI).toFixed(2)} mi`
function fmtPace(secPerKm) {
  if (!secPerKm || !isFinite(secPerKm)) return '—'
  const secPerMi = secPerKm * 1.609344
  const mm = Math.floor(secPerMi / 60)
  const ss = Math.round(secPerMi % 60)
  return `${mm}:${String(ss).padStart(2, '0')}`
}
function fmtDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}
const fmtEta = (remainingM, secPerKm) =>
  !secPerKm || !isFinite(secPerKm) ? '—' : fmtDuration((remainingM / 1000) * secPerKm * 1000)

// Interpolate lat/lng positions at each whole mile along the route.
function buildMileMarkers(latlngs, metrics) {
  if (!latlngs || !metrics) return []
  const out = []
  for (let mile = 1; mile * M_PER_MI < metrics.total; mile++) {
    const target = mile * M_PER_MI
    let i = 1
    while (i < metrics.cum.length && metrics.cum[i] < target) i++
    const s = metrics.cum[i - 1]
    const e = metrics.cum[i]
    const t = e > s ? (target - s) / (e - s) : 0
    const [aLat, aLng] = latlngs[i - 1]
    const [bLat, bLng] = latlngs[i]
    out.push({ mile, pos: [aLat + t * (bLat - aLat), aLng + t * (bLng - aLng)] })
  }
  return out
}
const MILE_MARKERS = buildMileMarkers(ROUTE, ROUTE_METRICS)
const ROUTE_TOTAL_MI = ROUTE_METRICS ? ROUTE_METRICS.total / M_PER_MI : 0

function mileIcon(mile) {
  return L.divIcon({
    className: 'mile-marker',
    html: `<span class="mile-badge">${mile}<small>MI</small></span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  })
}

function routePin(label, color) {
  return L.divIcon({
    className: 'route-pin',
    html: `<span class="route-pin-badge" style="--c:${color}">${label}</span>`,
    iconSize: [46, 22],
    iconAnchor: [23, 11],
    popupAnchor: [0, -12],
  })
}

// Fit the map to the route once on load (until the user's own fix takes over).
function FitRoute({ latlngs, active }) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (active && latlngs && !done.current) {
      map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] })
      done.current = true
    }
  }, [active, latlngs, map])
  return null
}

// Connect same-origin (dev: Vite proxies /ws → :3001; prod: same Node server).
// If the live server lives on a DIFFERENT host than the page (e.g. site on
// Netlify, server on Render), set VITE_WS_URL at build time, e.g.
//   VITE_WS_URL=wss://your-server.onrender.com/ws
const WS_URL =
  import.meta.env.VITE_WS_URL ||
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`

const COLOR_ME = '#ff7a3d'
const COLOR_OTHER = '#2e86c7'

function runnerIcon(color, isMe) {
  return L.divIcon({
    className: `runner-marker${isMe ? ' me' : ''}`,
    html: `<span class="dot" style="--c:${color}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  })
}

function ago(ts, now) {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  return `${Math.floor(s / 60)}m ago`
}

// Recenter the map on the user's first fix, without fighting them afterward.
function RecenterOnce({ pos }) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (pos && !done.current) {
      map.setView([pos.lat, pos.lng], 16)
      done.current = true
    }
  }, [pos, map])
  return null
}

// While "follow" is on, keep the map centered on the user as they move.
function FollowMe({ pos, follow }) {
  const map = useMap()
  useEffect(() => {
    if (follow && pos) map.panTo([pos.lat, pos.lng], { animate: true, duration: 0.5 })
  }, [pos, follow, map])
  return null
}

// Panning the map by hand turns follow off, so the map stops fighting the user.
function StopFollowOnDrag({ onUserPan }) {
  useMapEvents({ dragstart: onUserPan })
  return null
}

export default function LiveMap() {
  const [name, setName] = useState('')
  const [mode, setMode] = useState('off') // 'off' | 'sharing' | 'watching'
  const [connected, setConnected] = useState(false)
  const [myId, setMyId] = useState(null)
  const [myPos, setMyPos] = useState(null)
  const [runners, setRunners] = useState([])
  const [error, setError] = useState('')
  const [wsError, setWsError] = useState('')
  const [notice, setNotice] = useState('')
  const [now, setNow] = useState(Date.now())
  const [showRoute, setShowRoute] = useState(true)
  const [follow, setFollow] = useState(false)
  const [mileReached, setMileReached] = useState(0) // mile just crossed, 0 = none

  const wsRef = useRef(null)
  const lastPosRef = useRef(null) // last GPS fix, re-sent by the heartbeat
  const maxMileRef = useRef(0) // highest whole mile reached this session
  const mapRef = useRef(null) // Leaflet map instance
  const markerRefs = useRef({}) // runner id -> Leaflet marker
  const nameRef = useRef(name)
  useEffect(() => {
    nameRef.current = name
  }, [name])

  // Tick once a second so "active Xs ago" stays fresh.
  useEffect(() => {
    if (mode === 'off') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [mode])

  useEffect(() => {
    if (mode === 'off') return

    const sharing = mode === 'sharing'

    if (sharing && !('geolocation' in navigator)) {
      setError('Geolocation is not supported by this browser.')
      setMode('off')
      return
    }

    let closedByUs = false
    let reconnectTimer
    let everConnected = false

    const connect = () => {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws
      ws.onopen = () => {
        everConnected = true
        setConnected(true)
        setWsError('')
        setNotice('')
      }
      ws.onmessage = (e) => {
        let msg
        try {
          msg = JSON.parse(e.data)
        } catch {
          return
        }
        if (msg.type === 'welcome') setMyId(msg.id)
        else if (msg.type === 'runners') setRunners(msg.runners)
      }
      ws.onclose = (ev) => {
        setConnected(false)
        // Host ended the session (admin disconnect): stop, don't reconnect.
        if (ev.code === 4001) {
          setNotice('The live map was closed by the host. Tap start to rejoin.')
          setMode('off')
          return
        }
        if (!everConnected) {
          setWsError(
            `Couldn't reach the live server at ${WS_URL}. The Node server must be running and long-lived — a static host (e.g. plain Netlify) can't serve it. If the server is on another host, set VITE_WS_URL at build time.`,
          )
        }
        if (!closedByUs) reconnectTimer = setTimeout(connect, 2500)
      }
      ws.onerror = () => ws.close()
    }
    connect()

    const sendPos = (p) => {
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'update', name: nameRef.current, lat: p.lat, lng: p.lng }))
      }
    }

    let watchId
    let heartbeat
    if (sharing) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setError('')
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          lastPosRef.current = p
          setMyPos(p)
          sendPos(p)
        },
        (err) => setError(err.message || 'Could not get your location.'),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
      )

      // watchPosition only fires when you MOVE, but the server prunes runners
      // silent for 30s. Re-send the last fix every 10s so a stationary runner
      // (waiting at the start, standing still) stays on the map.
      heartbeat = setInterval(() => {
        if (lastPosRef.current) sendPos(lastPosRef.current)
      }, 10_000)
    }

    return () => {
      closedByUs = true
      clearTimeout(reconnectTimer)
      if (heartbeat) clearInterval(heartbeat)
      lastPosRef.current = null
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN && sharing) {
        ws.send(JSON.stringify({ type: 'leave' }))
      }
      ws?.close()
      wsRef.current = null
      setConnected(false)
      setRunners([])
      setMyId(null)
      setMyPos(null)
      setFollow(false)
      maxMileRef.current = 0
      setMileReached(0)
    }
  }, [mode])

  // Keep the screen awake while sharing so the phone doesn't auto-lock (which
  // would suspend geolocation). Best-effort: unsupported on some browsers, and
  // it only works while the tab is visible — it can't track with the screen off.
  useEffect(() => {
    if (mode !== 'sharing' || !('wakeLock' in navigator)) return
    let lock = null
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
      } catch {
        /* denied or not allowed (e.g. tab not visible) — ignore */
      }
    }
    acquire()
    // Wake locks are released when the tab is hidden; re-acquire on return.
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release?.().catch(() => {})
    }
  }, [mode])

  const activeCount = runners.length

  // Clicking a roster row flies the map to that runner and opens their popup.
  const focusRunner = (r) => {
    const map = mapRef.current
    if (!map) return
    map.flyTo([r.lat, r.lng], Math.max(map.getZoom(), 16), { duration: 0.75 })
    markerRefs.current[r.id]?.openPopup()
  }

  // "Center on me": snap to my current position and start following it.
  const centerOnMe = () => {
    const map = mapRef.current
    if (!map || !myPos) return
    map.flyTo([myPos.lat, myPos.lng], Math.max(map.getZoom(), 16), { duration: 0.6 })
    setFollow(true)
  }
  const me = myId ? runners.find((r) => r.id === myId) : null
  const myProgress = me ? routeProgress({ lat: me.lat, lng: me.lng }) : null

  // Detect crossing a whole mile so we can celebrate it. Track the max mile
  // reached (not the current one) so GPS jitter near a marker can't re-trigger.
  const myMilesDone = myProgress ? Math.floor(myProgress.along / M_PER_MI) : null
  useEffect(() => {
    if (myMilesDone == null) return
    if (myMilesDone > maxMileRef.current) {
      const reached = myMilesDone
      maxMileRef.current = reached
      if (reached >= 1) {
        setMileReached(reached)
        if (navigator.vibrate) {
          try {
            navigator.vibrate([180, 90, 180])
          } catch {
            /* not supported */
          }
        }
      }
    }
  }, [myMilesDone])

  // Auto-dismiss the mile banner.
  useEffect(() => {
    if (!mileReached) return
    const t = setTimeout(() => setMileReached(0), 10_000)
    return () => clearTimeout(t)
  }, [mileReached])

  const statusText =
    mode === 'off'
      ? 'Not connected'
      : !connected
        ? 'Connecting…'
        : mode === 'watching'
          ? `Watching · ${activeCount} runner${activeCount === 1 ? '' : 's'} sharing`
          : `Sharing live · ${activeCount} runner${activeCount === 1 ? '' : 's'} on the map`

  return (
    <section className="live">
      <div className="live-top container">
        <p className="eyebrow eyebrow-dark">On the riverfront right now</p>
        <h1>Live Runner Map</h1>
        <p className="live-lead">
          Out for the Sunday run? Turn on location sharing to see everyone moving on the riverfront
          in real time — and let them see you. Just want to keep an eye on the group? Watch the map
          without sharing.
        </p>
      </div>

      <div className="live-body container">
        <aside className="live-panel">
          <label className="field">
            <span>Display name</span>
            <input
              type="text"
              placeholder="e.g. Kunle"
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
              disabled={mode !== 'off'}
            />
          </label>

          {mode === 'off' && (
            <>
              <button className="btn btn-lg live-btn" onClick={() => setMode('sharing')}>
                Start sharing my location
              </button>
              <button className="btn live-btn live-btn-secondary" onClick={() => setMode('watching')}>
                Just watch the map
              </button>
            </>
          )}
          {mode === 'sharing' && (
            <button className="btn btn-lg btn-stop live-btn" onClick={() => setMode('off')}>
              Stop sharing
            </button>
          )}
          {mode === 'watching' && (
            <button className="btn btn-lg btn-stop live-btn" onClick={() => setMode('off')}>
              Stop watching
            </button>
          )}

          <div className="live-status">
            <span className={`status-dot ${mode !== 'off' && connected ? 'on' : 'off'}`} />
            {statusText}
          </div>

          {mode === 'watching' && (
            <p className="live-note">👀 Watch mode — your location is not being shared.</p>
          )}
          {mode === 'sharing' && (
            <p className="live-note">
              📱 Keep this tab open with your screen on. We keep the screen awake while you share,
              but phone browsers pause location if the screen locks or you switch apps — you’ll
              reappear when you come back.
            </p>
          )}
          {error && <p className="live-error">⚠️ {error}</p>}
          {wsError && <p className="live-error">⚠️ {wsError}</p>}
          {notice && <p className="live-note">👋 {notice}</p>}

          {mode === 'sharing' && me && (
            <div className="my-stats">
              <h3>Your run</h3>
              <div className="stat-grid">
                <div className="stat">
                  <span className="stat-value">{fmtDist(me.distance || 0)}</span>
                  <span className="stat-label">Distance</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{fmtDuration(now - me.startedAt)}</span>
                  <span className="stat-label">Time</span>
                </div>
                <div className="stat">
                  <span className="stat-value">
                    {fmtPace(me.paceSecPerKm)}
                    <span className="stat-unit"> /mi</span>
                  </span>
                  <span className="stat-label">Pace</span>
                </div>
                {myProgress && (
                  <>
                    <div className="stat">
                      <span className="stat-value">{fmtDist(myProgress.remaining)}</span>
                      <span className="stat-label">Route left*</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{fmtEta(myProgress.remaining, me.paceSecPerKm)}</span>
                      <span className="stat-label">Est. to finish*</span>
                    </div>
                  </>
                )}
              </div>
              {myProgress && (
                <p className="stat-foot">
                  * estimated from your nearest point on the route
                  {myProgress.off > 120 ? ` (you’re ~${Math.round(myProgress.off)} m off it)` : ''}.
                </p>
              )}
            </div>
          )}

          {ROUTE && (
            <label className="route-toggle">
              <input
                type="checkbox"
                checked={showRoute}
                onChange={(e) => setShowRoute(e.target.checked)}
              />
              <span>Show the run route</span>
            </label>
          )}

          <p className="live-privacy">
            🔒 <strong>Your privacy:</strong> sharing is opt-in and stops the moment you press
            “Stop” or close this tab. Locations are kept in memory only, never saved, and disappear
            after you leave. Only people with this page open while you’re sharing can see you.
          </p>
        </aside>

        <div className="live-map-wrap">
          <MapContainer
            center={MAP.center}
            zoom={MAP.zoom}
            className="live-map"
            scrollWheelZoom
            ref={mapRef}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <RecenterOnce pos={myPos} />
            <FollowMe pos={myPos} follow={follow} />
            <StopFollowOnDrag onUserPan={() => setFollow(false)} />
            {ROUTE && showRoute && (
              <>
                <FitRoute latlngs={ROUTE} active={!myPos} />
                <Polyline
                  positions={ROUTE}
                  pathOptions={{ color: ROUTE_COLOR, weight: 5, opacity: 0.85 }}
                />
                <Marker position={ROUTE[0]} icon={routePin('START', '#37c26b')}>
                  <Popup>Start</Popup>
                </Marker>
                <Marker position={ROUTE[ROUTE.length - 1]} icon={routePin('FINISH', '#e0533d')}>
                  <Popup>Finish</Popup>
                </Marker>
                {MILE_MARKERS.map((m) => (
                  <Marker key={`mi-${m.mile}`} position={m.pos} icon={mileIcon(m.mile)}>
                    <Popup>Mile {m.mile}</Popup>
                  </Marker>
                ))}
              </>
            )}
            {runners.map((r) => {
              const isMe = r.id === myId
              return (
                <Marker
                  key={r.id}
                  position={[r.lat, r.lng]}
                  icon={runnerIcon(isMe ? COLOR_ME : COLOR_OTHER, isMe)}
                  ref={(m) => {
                    if (m) markerRefs.current[r.id] = m
                    else delete markerRefs.current[r.id]
                  }}
                >
                  <Popup>{isMe ? `${r.name || 'You'} (you)` : r.name || 'Runner'}</Popup>
                </Marker>
              )
            })}
          </MapContainer>
          {mileReached > 0 && (
            <div className="mile-toast" role="status">
              🎉 Mile {mileReached} done{ROUTE_TOTAL_MI ? ` of ~${ROUTE_TOTAL_MI.toFixed(1)}` : ''}!
              Take a walk break if you like, then keep going.
              <button onClick={() => setMileReached(0)} aria-label="Dismiss">
                ×
              </button>
            </div>
          )}
          {myPos && (
            <button
              type="button"
              className={`locate-btn${follow ? ' active' : ''}`}
              onClick={centerOnMe}
              title={follow ? 'Following your location' : 'Center on my location'}
              aria-label="Center on my location"
            >
              <span className="locate-icon" aria-hidden="true">◎</span>
              {follow ? 'Following' : 'Center on me'}
            </button>
          )}
          {mode === 'off' && (
            <div className="live-map-overlay">
              <p>Start sharing or watch the map to see who’s out running.</p>
            </div>
          )}
        </div>
      </div>

      <div className="live-roster container">
        <h2>
          Who’s out right now <span className="roster-count">{activeCount}</span>
        </h2>
        {mode !== 'off' && activeCount > 0 && (
          <p className="roster-hint">Tap a runner to jump to them on the map.</p>
        )}
        {mode === 'off' ? (
          <p className="roster-empty">Start sharing or watching to see the roster.</p>
        ) : activeCount === 0 ? (
          <p className="roster-empty">No one is sharing a location yet. Be the first!</p>
        ) : (
          <div className="roster-table-wrap">
            <table className="roster-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Runner</th>
                  <th>Distance</th>
                  <th>Pace</th>
                  {ROUTE_METRICS && <th>Mile</th>}
                  {ROUTE_METRICS && <th>Route left</th>}
                  <th>Last update</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {runners.map((r) => {
                  const isMe = r.id === myId
                  const prog = ROUTE_METRICS ? routeProgress({ lat: r.lat, lng: r.lng }) : null
                  return (
                    <tr
                      key={r.id}
                      className={`roster-row${isMe ? ' is-me' : ''}`}
                      role="button"
                      tabIndex={0}
                      title="Show on map"
                      onClick={() => focusRunner(r)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          focusRunner(r)
                        }
                      }}
                    >
                      <td>
                        <span
                          className="roster-dot"
                          style={{ background: isMe ? COLOR_ME : COLOR_OTHER }}
                        />
                      </td>
                      <td>
                        {r.name || 'Runner'}
                        {isMe && <span className="you-badge">you</span>}
                      </td>
                      <td className="roster-num">{fmtDist(r.distance || 0)}</td>
                      <td className="roster-num">
                        {r.paceSecPerKm ? `${fmtPace(r.paceSecPerKm)} /mi` : '—'}
                      </td>
                      {ROUTE_METRICS && (
                        <td>
                          {prog ? (
                            <div className="mile-cell">
                              <span className="mile-pill">
                                Mile {Math.min(Math.ceil(ROUTE_TOTAL_MI), Math.floor(prog.along / M_PER_MI) + 1)}
                              </span>
                              <span className="mile-bar">
                                <span
                                  style={{ width: `${(((prog.along % M_PER_MI) / M_PER_MI) * 100).toFixed(0)}%` }}
                                />
                              </span>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                      )}
                      {ROUTE_METRICS && (
                        <td className="roster-num">{prog ? fmtDist(prog.remaining) : '—'}</td>
                      )}
                      <td>{ago(r.updated, now)}</td>
                      <td className="roster-locate" aria-hidden="true">📍</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
