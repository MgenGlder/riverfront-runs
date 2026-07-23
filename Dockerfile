# Server-only image for Fly.io (or any container host).
# Runs the live-map WebSocket server; the static site is served separately (Netlify).
FROM node:22-slim

WORKDIR /app

# Install production deps only. (The server itself just needs `ws`; installing
# from the committed lockfile keeps builds reproducible.)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Only the server code is needed — no Vite build, no frontend bundle.
COPY server ./server

# Fly routes to this internal port (matches fly.toml internal_port).
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server/index.js"]
