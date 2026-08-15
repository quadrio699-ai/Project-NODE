# Project-NODE Dockerfile
# Builds a container that runs the Express server directly — no
# separate build step needed, since the frontend is plain HTML/CSS/JS
# with no framework/bundler in the way.

FROM node:20-slim

WORKDIR /app

# Copy just the dependency manifests first, so Docker can cache the
# npm install layer — it only re-runs if package.json actually changes,
# not on every single code edit. Speeds up rebuilds a lot.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Now copy everything else (server.js, index.html, dashboard.html,
# lessons/, etc.)
COPY . .

# The app listens on port 80 by default, or whatever PORT the hosting
# platform assigns via environment variable (Render/Railway typically
# do this automatically) — see server.js.
EXPOSE 80

# JWT_SECRET and DATA_DIR are expected to be set as environment
# variables by whichever platform deploys this (Render/Railway/Fly.io
# Variables tab) — not hardcoded here, since they're meant to differ
# per environment and DATA_DIR in particular needs to point at whatever
# persistent volume/disk that platform gives you.

CMD ["node", "server.js"]
