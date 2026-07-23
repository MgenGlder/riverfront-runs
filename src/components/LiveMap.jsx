import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MAP } from '../config.js'

// Connect same-origin (dev: Vite proxies /ws → :3001; prod: same Node server).
// Override with VITE_WS_URL if the live server lives on a different host.
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

export default function LiveMap() {
  const [name, setName] = useState('')
  const [sharing, setSharing] = useState(false)
  const [connected, setConnected] = useState(false)
  const [myId, setMyId] = useState(null)
  const [myPos, setMyPos] = useState(null)
  const [runners, setRunners] = useState([])
  const [error, setError] = useState('')

  const wsRef = useRef(null)
  const nameRef = useRef(name)
  useEffect(() => {
    nameRef.current = name
  }, [name])

  useEffect(() => {
    if (!sharing) return

    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by this browser.')
      setSharing(false)
      return
    }

    let closedByUs = false
    let reconnectTimer

    const connect = () => {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws
      ws.onopen = () => setConnected(true)
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
      ws.onclose = () => {
        setConnected(false)
        if (!closedByUs) reconnectTimer = setTimeout(connect, 2000)
      }
      ws.onerror = () => ws.close()
    }
    connect()

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setError('')
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setMyPos(p)
        const ws = wsRef.current
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'update', name: nameRef.current, lat: p.lat, lng: p.lng }))
        }
      },
      (err) => setError(err.message || 'Could not get your location.'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )

    return () => {
      closedByUs = true
      clearTimeout(reconnectTimer)
      navigator.geolocation.clearWatch(watchId)
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'leave' }))
      ws?.close()
      wsRef.current = null
      setConnected(false)
      setRunners([])
      setMyId(null)
      setMyPos(null)
    }
  }, [sharing])

  const activeCount = runners.length

  return (
    <section className="live">
      <div className="live-top container">
        <p className="eyebrow eyebrow-dark">On the riverfront right now</p>
        <h1>Live Runner Map</h1>
        <p className="live-lead">
          Out for the Sunday run? Turn on location sharing to see everyone moving on the riverfront
          in real time — and let them see you.
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
              disabled={sharing}
            />
          </label>

          {!sharing ? (
            <button className="btn btn-lg live-btn" onClick={() => setSharing(true)}>
              Start sharing my location
            </button>
          ) : (
            <button className="btn btn-lg btn-stop live-btn" onClick={() => setSharing(false)}>
              Stop sharing
            </button>
          )}

          <div className="live-status">
            <span className={`status-dot ${sharing && connected ? 'on' : 'off'}`} />
            {sharing
              ? connected
                ? `Sharing live · ${activeCount} runner${activeCount === 1 ? '' : 's'} on the map`
                : 'Connecting…'
              : 'Not sharing'}
          </div>

          {error && <p className="live-error">⚠️ {error}</p>}

          <p className="live-privacy">
            🔒 <strong>Your privacy:</strong> sharing is opt-in and stops the moment you press
            “Stop sharing” or close this tab. Locations are kept in memory only, never saved, and
            disappear after you leave. Only people with this page open while you’re sharing can see
            you.
          </p>
        </aside>

        <div className="live-map-wrap">
          <MapContainer center={MAP.center} zoom={MAP.zoom} className="live-map" scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <RecenterOnce pos={myPos} />
            {runners.map((r) => {
              const isMe = r.id === myId
              return (
                <Marker
                  key={r.id}
                  position={[r.lat, r.lng]}
                  icon={runnerIcon(isMe ? COLOR_ME : COLOR_OTHER, isMe)}
                >
                  <Popup>{isMe ? `${r.name || 'You'} (you)` : r.name || 'Runner'}</Popup>
                </Marker>
              )
            })}
          </MapContainer>
          {!sharing && (
            <div className="live-map-overlay">
              <p>Start sharing to appear on the map and see other runners.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
