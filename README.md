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
- **Real accounts** — students sign up with a name and password (hashed, never stored in plain text). Every account is created as a `student` by default.
- **Password reset without internet** — each account sets a security question at signup. Forgetting a password doesn't mean losing quiz progress: answer the question, set a new password, all handled locally with no email or SMS involved.

## Tech Stack

- **Backend:** Node.js, Express
- **Storage:** Node's built-in SQLite (`node:sqlite`, no separate package) for accounts; JSON (`database.json`) for comments
- **Auth:** bcrypt password hashing + JWT sessions
- **Frontend:** Static HTML/CSS/JS served directly by Express
- **Deployment:** Local intranet (Docker-ready)

## Running it locally

```bash
npm install
node server.js
# Visit http://localhost:80
```

Set a `JWT_SECRET` environment variable before deploying anywhere real (on Railway: Variables tab → add `JWT_SECRET` → any long random string). Without it, the server falls back to an insecure default and prints a warning.

⚠️ **Before deploying to Railway for real:** attach a persistent Volume, or every student account and comment vanishes on your next `git push`. Steps:
1. On Railway, press `Cmd/Ctrl + K` (or right-click the project canvas) → **New → Volume**
2. Attach it to your NODE service, set the mount path to `/app/data`
3. In the service's **Variables** tab, add `DATA_DIR` = `/app/data`
4. Redeploy once — after that, accounts and comments persist across every future push

(Don't mount a volume directly over `/app` itself — that hides your newly deployed code behind old volume data on every future push. `/app/data` keeps storage separate from code.)

## Sorting out MIT OCW downloads

MIT OCW zip downloads bundle a lot together — lecture notes, assignments, exams, and often huge video/audio files, all mixed into nested folders. `organize-ocw.js` pulls out just the lightweight files (PDFs, docs, slides) and drops them straight into the right lesson folder, skipping videos/audio (which are usually hundreds of MB each and impractical to hand out over a local network).

```bash
node organize-ocw.js <path-to-zip> <Category> <Topic>

# Example:
node organize-ocw.js ~/Downloads/6-006-fall-2020.zip Computing Algorithm
```

Category must be one of: `Computing`, `Education`, `Engineering`, `Public Resources`, `Science` (these are the only ones the app scans for). The script tells you exactly how many files it added and how much video/audio it skipped.

## Making someone a teacher

There's no self-service "sign up as teacher" option on purpose — otherwise any student could grant themselves upload access. To promote an existing account, run this on the server:

```bash
node -e "const {DatabaseSync}=require('node:sqlite'); new DatabaseSync('node.db').prepare(\"UPDATE users SET role='teacher' WHERE name=?\").run('their-name-here')"
```

## File Structure

```
project NODE/
├── server.js          ← Main server + all routes
├── auth.js            ← Signup/login + JWT session handling
├── db.js              ← SQLite setup (accounts)
├── organize-ocw.js     ← Sorts MIT OCW zip downloads into lessons/
├── index.html          ← Student portal frontend
├── database.json        ← Comments/messages store
├── node.db              ← Accounts database (auto-created, git-ignored)
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