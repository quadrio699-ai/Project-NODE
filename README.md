# Project NODE

A student portal built to work with **or without** dependable internet — from a single classroom to an entire university.

Built while teaching physics, to solve a real problem: students needed access to lesson files, resources, and a way to communicate in class, without dependable internet. What started as a local-intranet-only tool has grown into a three-tier access system, now being expanded to cover every LASU faculty and department, with a planned SSO integration into [LASU Connect](https://github.com/lord-saviord1/lasu-connect).

This is the origin project that shaped a broader focus on offline-first infrastructure, which later grew into NODE SECURITY.

## The three-tier access model

Project NODE is designed around three different ways a student might reach it, because "no internet" doesn't mean the same thing for every student:

1. **On-campus, near a fixed access point** (a student union office, an e-board) — direct Wi-Fi/LAN access to whichever device is currently running the server. Fastest, fullest access. See `/connect`.
2. **Off-campus, with regular internet** — a publicly deployed, searchable version of the site (`index.html`), independent of any one device being turned on. Search works without logging in; logging in unlocks the full course library.
3. **No internet at all, but a nearby peer has the content** — direct phone-to-phone QR transfer. No network required for the transfer itself, just a camera. See `/qr-broadcast` and `/qr-scan`.

## How it works

- **Local network or public deployment** — runs on Node.js/Express, servable purely over a local intranet on port 80, or deployed publicly (see Deployment below).
- **Live presence tracking** — a heartbeat system tracks which students are currently online, cleaning up inactive sessions automatically after 10 seconds of inactivity.
- **Session-scoped messaging** — students only see class comments/messages posted after their current session started.
- **Faculty → Department → Level → Course lesson library** — lessons are organized to mirror real university structure, not fixed categories, and can be nested to any depth. See lessons/METADATA_SCHEMA.md for the full spec and `CONTRIBUTOR_GUIDE.md for a plain-language guide to adding content correctly.
- **Cross-listing without duplication** — a course taught (with variations) across multiple departments — Statistics being the working example — lives once as canonical content, with each department only storing what's actually different for them. See the schema doc for the pattern.
- **Fuzzy, alias-aware search** — `/api/search?q=` handles typos and abbreviations ("Maths" finds "Mathematics", "compsci" finds "Computer Science") across faculty, department, course name, and topic tags — not just exact matches.
- **Secure downloads** — students can download lesson files directly through a dedicated download route.
- **On-demand PDF export** — every markdown lesson file has a "Print / Save as PDF" option, rendered fresh on request (via `marked`) rather than storing a heavy duplicate — keeps the offline footprint small.
- **Real accounts** — students sign up with a name and password (hashed, never stored in plain text). Every account is created as a student by default.
- **Password reset without internet** — each account sets a security question at signup, handled entirely locally.
- **Auto-connect QR** — `/connect` detects its own device's LAN IP and generates a QR code pointing at itself, refreshed hourly. No one has to type or share an IP address by hand.
- **Peer-to-peer QR file transfer** — any file can be broadcast as a looping, animated QR sequence (`/qr-broadcast`) and picked up by another device's camera (`/qr-scan`), fully reconstructed and downloadable — verified end-to-end with zero data loss.
- **Installable as an app (PWA)** — `manifest.json` + `service-worker.js` make the site installable on a phone/desktop, with the app shell cached for offline loading. Note: browsers only enable this over HTTPS or on `localhost` — a plain local IP address (`http://192.168.x.x`) won't trigger the install prompt, which matters once testing beyond one device.
- **Kiosk-mode flagship display** — `start-kiosk.bat` launches the server and opens `/connect` in real Chrome kiosk mode (fullscreen, no address bar, incognito so no session lingers for the next person) — meant for an unattended shared screen.

## Tech Stack

- **Backend:** Node.js, Express
- **Storage:** Node's built-in SQLite (`node:sqlite`) for accounts; JSON (`database.json`) for comments; JSON `_meta.json` files per course for the metadata/search layer
- **Auth:** bcrypt password hashing + JWT sessions
- **Markdown → PDF-ready HTML:** `marked`
- **QR generation:** `qrcode` (server-side, for `/connect` and `/qr-broadcast`)
- **QR scanning:** `jsQR` (client-side, loaded via CDN on `/qr-scan` — runs on the student's device, needs internet once to load the page itself)
- **Frontend:** Static HTML/CSS/JS served directly by Express — no build step
- **Deployment:** Docker-ready; works locally, on a LAN, or publicly deployed

## Running it locally

```
npm install
node server.js
# Visit http://localhost
```

Or for a flagship/kiosk display device: double-click `start-kiosk.bat` — this starts the server and opens the QR connect screen in locked-down Chrome kiosk mode automatically.

Set a `JWT_SECRET` environment variable before deploying anywhere real. Without it, the server falls back to an insecure default and prints a warning.

## Deployment options

This app needs **persistent storage** (the SQLite accounts database, the `lessons/` folder, `database.json`) — that rules out purely serverless/stateless platforms like Vercel, and Heroku's free tier (ephemeral filesystem, no persistent disk without an add-on). Options that actually fit:

| Platform | Persistent storage | Notes |
|---|---|---|
| **Railway** | Volumes | Documented below — currently the most tested path |
| **Render** | Persistent Disks | Very similar setup to Railway |
| **Fly.io** | Volumes | Built around Docker — this repo already has a `Dockerfile` ready to go |
| **A VPS** (DigitalOcean, Linode, etc.) | Just a regular disk | Most control, but you own uptime/patching/security yourself |

### Deploying to Railway

⚠️ Before deploying to Railway for real: attach a persistent Volume, or every student account and comment vanishes on your next git push.

1. On Railway, press `Cmd/Ctrl + K` (or right-click the project canvas) → New → Volume
2. Attach it to your NODE service, set the mount path to `/app/data`
3. In the service's Variables tab, add `DATA_DIR = /app/data`
4. Also add `JWT_SECRET` → any long random string
5. Redeploy once — after that, accounts and comments persist across every future push

(Don't mount a volume directly over `/app` itself — that hides your newly deployed code behind old volume data on every future push. `/app/data` keeps storage separate from code.)

## Adding lesson content

Two ways to get content in:

**Manually, following the structure:** see [/CONTRIBUTOR_GUIDE.md](https://github.com/quadrio699-ai/Project-NODE/blob/main/contributorguide.md) — written for non-technical contributors, walks through folder naming, the `_meta.json` template, and the cross-listing pattern for shared courses.

**From MIT OCW downloads:** OCW zips bundle a lot together — lecture notes, assignments, exams, and often huge video/audio files. `organize-ocw.js` pulls out just the lightweight files (PDFs, docs, slides) and drops them into the right lesson folder, skipping videos/audio (usually hundreds of MB each and impractical to hand out over a local network or QR broadcast).

```
node organize-ocw.js <path-to-zip> <folder/path/inside/lessons>

# Example:
node organize-ocw.js ~/Downloads/6-006-fall-2020.zip "Science/Computer Science/300 Level/CSC 301 - Algorithms"
```

Unlike the original version, the destination can be **any depth** now — there's no fixed category list to keep in sync, since `lessons/` scans recursively to any depth.

## Making someone a teacher

There's no self-service "sign up as teacher" option on purpose — otherwise any student could grant themselves upload access. To promote an existing account, run this on the server:

```
node -e "const {DatabaseSync}=require('node:sqlite'); new DatabaseSync('node.db').prepare(\"UPDATE users SET role='teacher' WHERE name=?\").run('their-name-here')"
```

## Key routes

| Route | Purpose |
|---|---|
| `/` | Public search landing page — no login required |
| `/dashboard.html` | Full student portal — login, browse, download, comment |
| `/connect` | Auto-detecting QR connect screen, for a shared display device |
| `/qr-broadcast?path=...` | Broadcasts one file as a looping QR sequence |
| `/qr-scan` | Camera scanner — receives and reconstructs a broadcast file |
| `/api/data` | Full lesson folder tree (used by the dashboard's file browser) |
| `/api/catalog` | Flat, metadata-rich list of every course (used for filtering/QR relevance) |
| `/api/search?q=` | Fuzzy, alias-aware search across faculty/department/course/tags |
| `/api/download/*` | Direct file download |
| `/api/view/*` | Markdown rendered as print-ready HTML (for Print/Save as PDF) |
| `/api/connect-qr` | Returns the current device's LAN URL + QR image as JSON |
| `/api/qr-broadcast/*` | Returns the QR frame sequence for a given file |

## File Structure

```
project NODE/
├── server.js              ← Main server + all routes
├── auth.js                ← Signup/login + JWT session handling
├── db.js                  ← SQLite setup (accounts)
├── organize-ocw.js        ← Sorts MIT OCW zip downloads into lessons/
├── index.html              ← Public search landing page
├── dashboard.html          ← Logged-in student portal
├── manifest.json            ← PWA manifest
├── service-worker.js        ← PWA offline shell caching
├── CONTRIBUTOR_GUIDE.md ← Plain-language guide for adding content
├── start-kiosk.bat          ← One-click kiosk launcher for a flagship display
├── database.json            ← Comments/messages store
├── node.db                  ← Accounts database (auto-created, git-ignored)
├── lessons/                ← Lesson files, organized Faculty/Department/Level/Course
│   ├── METADATA_SCHEMA.md   ← Metadata spec + cross-listing pattern
│   └── [Faculty]/[Department]/[Level]/[Course]/
│       ├── _meta.json        ← Course metadata (faculty, tags, cross-listing)
│       └── notes.md           ← Actual content
├── Dockerfile
└── package.json
```

## Why offline-first

Most Nigerian classrooms — and most of a university campus once you step off a handful of Wi-Fi-covered spots — can't depend on stable internet. Project NODE doesn't treat that as an edge case to work around; the three-tier model is built around it directly, so a student's access doesn't collapse to zero just because they're not standing next to a router.

## Status

Actively expanding from a single-classroom proof of concept into a LASU-wide pilot — faculty-by-faculty content coverage is ongoing, and integration with LASU Connect (shared login, scoped visibility by faculty/department/level) is planned as the next major milestone.

## Credits

Built by [Quadri Marvellous Al-ameen](https://github.com/quadrio699-ai).

Improved upon by [Daniel Savior Ozoemena](https://github.com/lord-saviord1) / [Cipher PR](https://lord-saviord1.github.io/siteaboutme/).

Expanded with LASU-wide faculty/department structure, metadata and search, the three-tier offline access system, PWA support, and the LASU Connect integration groundwork, as part of an ongoing collaboration.
