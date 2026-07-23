# Riverfront Run Detroit

Landing page for **Riverfront Run Detroit** — a free, welcoming weekly community run on the
Detroit Riverfront, in front of the Renaissance Center. **Every Sunday at 2:00 PM.**

Built with **React + [Vite](https://vite.dev/)**, plus an optional **live runner map**
(WebSocket + Leaflet) so people can share their location during a run and see each other in real time.

## Links
- **Meetup group:** https://www.meetup.com/meetup-group-frisqziq/
- **Next run (RSVP):** https://www.meetup.com/meetup-group-frisqziq/events/315575219

## Quick start
```bash
npm install      # install dependencies
npm run dev      # starts BOTH the Vite app (http://localhost:5173)
                 # and the live-map WebSocket server (:3001)
```

Other scripts:
```bash
npm run build    # production build → dist/
npm run preview  # serve the Vite production build locally
npm run server   # run just the live-map WebSocket server
npm start        # production: serve the built site + live map from one Node server
```

## Live runner map
Optional feature on the **📍 Live Map** tab. Runners opt in, the browser asks for
location permission, and everyone currently sharing appears on a Leaflet/OpenStreetMap map
in real time.

**How it works**
- `src/components/LiveMap.jsx` — the map UI. Uses the browser Geolocation API
  (`watchPosition`) and a WebSocket connection.
- `server/index.js` — a small Node WebSocket server that keeps active runners **in memory**
  and broadcasts the roster to everyone connected.

**Privacy by design:** sharing is strictly opt-in, positions are never written to disk,
they're dropped the instant a runner disconnects or presses “Stop sharing”, and stale
runners auto-expire after 30 seconds. No accounts — just a display name.

**Requirements**
- Geolocation only works over **HTTPS** (or `localhost`). Any real host with HTTPS is fine.
- The live map needs the **Node server running** — a purely static host (plain GitHub Pages)
  serves the marketing page but not the live map.

## Project structure
```
index.html              Vite HTML entry (fonts + <div id="root">)
Dockerfile              Server-only image for Fly.io / any container host
fly.toml                Fly.io service config + ALLOWED_ORIGINS allowlist
render.yaml             Render blueprint (single-host: site + server together)
.github/workflows/
  fly-deploy.yml        Auto-deploy the server to Fly on push to main
.env.example            VITE_WS_URL docs for the split deploy
server/
  index.js              Live-map WebSocket server (+ serves dist/ in single-host mode)
public/
  flyer.png             Event flyer (served at /flyer.png)
src/
  main.jsx              React entry point
  App.jsx               Page composition + Home/Live tab switching
  config.js             Event details, Meetup links & map center (single source of truth)
  styles.css            All styling (colors pulled from the flyer)
  components/
    Header.jsx  Hero.jsx  Details.jsx  About.jsx
    Faq.jsx     CtaBand.jsx  Footer.jsx  LiveMap.jsx
```

## Editing content
- **Meetup links / dates:** edit `NEXT_EVENT_URL` and `MEETUP_GROUP_URL` in `src/config.js`.
  Every RSVP button reads from there — update it once when a new event is created.
- **Detail cards & FAQ:** the `DETAILS` and `FAQS` arrays in `src/config.js`.
- **Colors:** CSS variables at the top of `src/styles.css` (`:root`).

## Drawing the run route
The Live Map overlays a fixed route (blue line + START/FINISH pins) from
`src/route.json`, a GeoJSON file. It ships with a **placeholder** — replace it with your
real path:

1. Go to **[geojson.io](https://geojson.io)**.
2. Pick the **line tool** (top-right toolbar) and click along the run path — start at the
   Ren Cen meetup spot, follow the riverwalk, click each turn, double-click to finish.
3. Copy the GeoJSON from the panel on the right and paste it over the contents of
   `src/route.json` (keep the filename).
4. Commit/redeploy — the map picks it up automatically, draws the line, drops START/FINISH
   pins at the ends, and fits the view to the route.

Notes:
- GeoJSON stores coordinates as `[longitude, latitude]`; the app converts to Leaflet's
  `[lat, lng]` for you, so just paste geojson.io's output as-is.
- Only the **first `LineString`** is used. An out-and-back can retrace the same points; a
  loop can end where it starts.
- Runners can hide the overlay with the **“Show the run route”** toggle on the map panel.

### Prefer a GPX file? (e.g. exported from a watch/Strava)
GPX works **directly** — no conversion. Just drop your file in as **`src/route.gpx`** and
commit/redeploy. If that file exists it takes priority over `src/route.json`; the app reads
the track points (`<trkpt>`, falling back to `<rtept>`/`<wpt>`) and draws the same line +
START/FINISH pins. Remove the file to fall back to the GeoJSON.

## Deploy

> ### ⚠️ Live-map markers not showing after deploy?
> The live map needs a **long-running Node server** (`server/index.js`). Static/build-only
> hosts like **plain Netlify, Vercel, GitHub Pages, or Cloudflare Pages don't run it** —
> their serverless functions also can't hold a persistent WebSocket. The site loads, but the
> map never receives runners, so no markers appear. Fix: run the server on a host that stays
> alive (below). When it's misconfigured the Live Map tab now shows an explicit error instead
> of hanging on "Connecting…".

### Option A — everything on one Node host (simplest, recommended)
Deploy to a host that runs Node (**Render, Railway, Fly.io, a VPS**). One process serves the
built site *and* the WebSocket from the same origin, so **no env var is needed**.
```bash
npm ci && npm run build && npm start   # honors the PORT env var
```
A ready-made **Render blueprint** is included: in Render, *New + → Blueprint*, point it at
this repo, and it uses `render.yaml`. Railway/Fly: build command `npm ci && npm run build`,
start command `npm start`.

### Option B — static site on Netlify + server on Fly.io (your setup)
The site and server live on **different domains**, so two paired settings connect them:

| Where | Variable | Value | Read at |
|-------|----------|-------|---------|
| **Netlify** (site) | `VITE_WS_URL` | `wss://<your-fly-app>.fly.dev/ws` | build time |
| **Fly** (server) | `ALLOWED_ORIGINS` | `https://<your-site>.netlify.app` | runtime |

`VITE_WS_URL` tells the page where to connect; `ALLOWED_ORIGINS` tells the server which
site(s) are allowed to connect (see "Cross-origin & security" below).

**Deploy the server to Fly** (uses the included `Dockerfile` + `fly.toml`, server-only —
no Vite build in the image). The allowed origins are committed in `fly.toml`'s `[env]`
(they're public URLs), so there's no secret to set for CORS:
```bash
fly launch --no-deploy   # first time: creates the app; match the name in fly.toml
fly deploy               # or push to main and let the GitHub Action deploy (below)
# note the app URL, e.g. https://riverfront-runs.fly.dev  (health check at /health)
```
The allowlist lives in `fly.toml`:
```toml
[env]
  ALLOWED_ORIGINS = "https://riverfrontruns.netlify.app,https://riverfrontruns2.netlify.app"
```
Add or change origins by editing that line and redeploying (comma-separated; trailing
slash optional — the server normalizes it).

**Auto-deploy on push (GitHub Actions):** `.github/workflows/fly-deploy.yml` redeploys the
server to Fly whenever server files change on `main` (frontend-only changes are Netlify's
job and are ignored). One-time setup:
```bash
fly tokens create deploy -x 999999h        # create a deploy token
```
Then in GitHub: *Settings → Secrets and variables → Actions → New repository secret* →
name `FLY_API_TOKEN`, paste the token. You can also trigger it manually from the Actions tab
(*Run workflow*).

**Point Netlify at it:** *Site settings → Environment variables* → add
`VITE_WS_URL = wss://YOUR-FLY-APP.fly.dev/ws`, then trigger a redeploy so the build bakes it
in. (It's read by Vite at build time — changing it requires a rebuild.) See `.env.example`.

Adding a custom domain later? Update both: the new site origin in Fly's `ALLOWED_ORIGINS`
(comma-separate multiple) and the new server URL in Netlify's `VITE_WS_URL`.

#### Cross-origin & security (SOP / CORS)
- **WebSockets aren't governed by CORS or preflight** — a browser will open a cross-origin
  socket regardless. The actual guard is the **`Origin` header**, which the server validates
  against `ALLOWED_ORIGINS` on the upgrade to block cross-site WebSocket hijacking (CSWSH).
  A disallowed origin is rejected with **HTTP 403**.
- **HTTP endpoints** (e.g. `/health`) return proper **CORS headers**
  (`Access-Control-Allow-Origin` reflected for allowed origins only, plus `Vary: Origin`) and
  answer preflight `OPTIONS` with `204`.
- If `ALLOWED_ORIGINS` is **unset**, all origins are allowed — convenient for local dev and
  same-origin single-host deploys, but **set it in production** for the split setup.
- Use `wss://` (not `ws://`) from an HTTPS page, or the browser blocks it as mixed content.
  Fly's `force_https` + TLS termination make `wss://…fly.dev/ws` work out of the box.

### Marketing page only (no live map)
`npm run build` outputs a static site to `dist/` for any static host. For GitHub Pages under a
subpath (e.g. `username.github.io/riverfront-runs/`), set `base: '/riverfront-runs/'` in
`vite.config.js`, then deploy `dist/`. The Live Map tab will show a connection error unless you
also stand up the server (Option A/B).

### Heads-up on free tiers
Free plans on Render/Railway/Fly **sleep after inactivity** and reset in-memory state — fine
for a live map (runners re-appear when they reconnect), but the first visitor after idle may
wait a few seconds for the server to wake.
