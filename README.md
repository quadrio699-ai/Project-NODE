# Project NODE

**A local intranet student portal — no internet required.**

Built while teaching physics, to solve a real problem: students needed access to lesson files, resources, and a way to communicate in class, without dependable internet. Project NODE runs entirely on a local network, serving lessons, tracking who's online, and handling live class discussion — all offline.

This is the origin project that shaped a broader focus on offline-first infrastructure, which later grew into [NODE SECURITY](https://github.com/quadrio699-ai/NODE_SECURITY).

---

## How it works

- **Local network only** — runs on Node.js/Express, served over the local intranet on port 80. No external connectivity needed once installed.
- **Live presence tracking** — a heartbeat system tracks which students are currently online, cleaning up inactive sessions automatically after 10 seconds of inactivity.
- **Session-scoped messaging** — students only see class comments/messages posted *after* their current session started, so no one scrolls through old history from before they logged in.
- **Dynamic lesson library** — automatically scans and categorizes lesson files across subjects (Computing, Education, Engineering, Science, Public Resources), including nested subfolders like Physics → Electricity.
- **Secure downloads** — students can download lesson files directly through a dedicated download route.

## Tech Stack

- **Backend:** Node.js, Express
- **Storage:** JSON-based local database (`database.json`)
- **Frontend:** Static HTML/CSS/JS served directly by Express
- **Deployment:** Local intranet (Docker-ready)

## Running it locally

```bash
npm install
node server.js
# Visit http://localhost:80
```

## File Structure

```
project NODE/
├── server.js          ← Main server + all routes
├── index.html          ← Student portal frontend
├── database.json        ← Comments/messages store
├── lessons/            ← Lesson files, organized by subject
│   ├── Computing/
│   ├── Education/
│   ├── Engineering/
│   ├── Public Resources/
│   └── Science/
├── Dockerfile
└── package.json
```

## Why offline-first

Most Nigerian classrooms can't depend on stable internet. Project NODE removes that dependency entirely — once installed on a local machine, it works over a simple local network connection, no data required, no downtime from network outages.

## Status

Actively used as a proof of concept. Next step: piloting a deployment within a university department as a real-world case study.

---

Built by [Quadri Marvellous Al-ameen](https://github.com/quadrio699-ai)