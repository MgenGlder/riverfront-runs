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
server/
  index.js              Live-map WebSocket server (+ serves dist/ in production)
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

## Deploy

**Marketing page only (no live map):** `npm run build` outputs a static site to `dist/`
that works on any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages). For
GitHub Pages under a subpath (e.g. `username.github.io/riverfront-runs/`), set
`base: '/riverfront-runs/'` in `vite.config.js`, then deploy `dist/`.

**Full site incl. live map:** deploy to a host that runs Node (Render, Railway, Fly.io,
a VPS). Build, then start the server — it serves the built site *and* the WebSocket from
one process/port:
```bash
npm ci && npm run build && npm start   # respects the PORT env var
```
The browser connects to the WebSocket same-origin at `/ws`, so no extra config is needed.
If you host the live server on a **different** origin than the page, set `VITE_WS_URL`
(e.g. `VITE_WS_URL=wss://live.example.com/ws`) at build time.
