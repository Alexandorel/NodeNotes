# NodeNotes

> A web app for visual, graph-based note-taking. Create nodes, attach notes, color-code them by importance, and draw logical connections between ideas on an infinite canvas.

NodeNotes lets you turn unstructured thoughts into a navigable graph. Each user owns a set of graph files; every file is an infinite canvas of nodes (notes) connected by edges. Layout, zoom, and pan are persisted, and changes are auto-saved in the background.

**Live demo:** https://nodenotes-swf4.onrender.com

---

## Features

- **Graph canvas** — pan/zoom infinite canvas powered by [Cytoscape.js](https://js.cytoscape.org/), with resizable nodes and adaptive font sizing.
- **Rich nodes** — each node has a label, a free-text note, a size, and a color drawn from a five-level importance palette (Main → Side note).
- **Logical connections** — draw directed edges between nodes to model relationships.
- **Per-file persistence** — node positions, edges, and the camera view (zoom/pan) are stored, so files reopen exactly as you left them.
- **Debounced auto-save** — edits are persisted automatically with a live save-status indicator; no manual save button.
- **Authentication** — local email/password (bcrypt-hashed) and Google OAuth 2.0 sign-in, with account linking by email.
- **Server-side sessions** — sessions are stored in MongoDB and regenerated on every login to prevent fixation.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js (≥ 20) |
| Web framework | Express 5 |
| Views | EJS (server-side rendering) |
| Database | MongoDB + Mongoose |
| Sessions | express-session + connect-mongo |
| Auth | Passport (Google OAuth 2.0) + bcrypt |
| Hardening | express-rate-limit |
| Canvas (client) | Cytoscape.js |

## Architecture

NodeNotes is a server-rendered monolith. Express serves EJS pages for the marketing/auth flows and the editor shell; the editor itself is a vanilla-JS client that loads and saves graph state through a small JSON API.

```
Browser (EJS pages + Cytoscape canvas)
        │
        │  GET /api/files/:id   (load graph as JSON)
        │  PUT /api/files/:id   (save graph as JSON)
        ▼
Express app  ──►  Passport (local + Google)  ──►  bcrypt
        │
        ▼
Mongoose models  ──►  MongoDB
   ├── User           (credentials, googleId)
   ├── GraphFile      (nodes, edges, view)
   └── sessions       (managed by connect-mongo)
```

### Project structure

```
.
├── app.js                  # App bootstrap: middleware, sessions, routes, error handler
├── config/
│   └── passport.js         # Google OAuth strategy + (de)serialization
├── db/
│   ├── index.js            # Mongoose connection
│   ├── users.js            # User model
│   └── files.js            # GraphFile model (nodes/edges/view sub-schemas)
├── middleware/
│   └── requireLogin.js     # Session guard for protected routes
├── routes/
│   ├── auth.js             # Login/register/logout/Google + rate limiting
│   └── files.js            # Dashboard, file CRUD, graph load/save API
├── views/                  # EJS templates (home, login, register, dashboard, canvas)
└── public/                 # Static assets (canvas.js, css, favicons)
```

### Data model

A `GraphFile` is owned by a `User` and embeds its nodes and edges directly (no separate collections), which keeps a single file load to one query:

```jsonc
{
  "ownerId": "ObjectId(User)",
  "name": "My graph",
  "nodes": [
    { "nodeId": "...", "label": "Idea", "note": "...", "x": 0, "y": 0,
      "w": 80, "h": 80, "fontSize": 13, "color": "#ef4444" }
  ],
  "edges": [
    { "edgeId": "...", "source": "nodeId-a", "target": "nodeId-b" }
  ],
  "view": { "zoom": 1, "panX": 0, "panY": 0 }
}
```

## Getting started

### Prerequisites

- Node.js ≥ 20
- A running MongoDB instance (local `mongod`, or a MongoDB Atlas cluster)
- A Google OAuth 2.0 Client (only if you want Google sign-in)

### 1. Install

```bash
git clone https://github.com/Alexandorel/NodeNotes.git
cd NodeNotes
npm install
```

### 2. Configure environment

Create a `.env` file in the project root:

```dotenv
PORT=3000
BASE_URL=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/nodenotes
SESSION_SECRET=<a long random string>
GOOGLE_CLIENT_ID=<your google client id>
GOOGLE_CLIENT_SECRET=<your google client secret>
```

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | no | Port to listen on (default `3000`). |
| `BASE_URL` | no (prod: yes) | Public base URL; used to build the OAuth callback. Falls back to `http://localhost:PORT`. |
| `MONGODB_URI` | **yes** | MongoDB connection string. |
| `SESSION_SECRET` | **yes in production** | Secret used to sign session cookies. In dev, falls back to a placeholder. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | for Google login | Credentials from Google Cloud Console. |

> Generate a strong secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

For Google sign-in, register the redirect URI `${BASE_URL}/auth/google/callback` in the Google Cloud Console under **APIs & Services → Credentials**.

### 3. Run

```bash
npm start
```

Then open http://localhost:3000.

## API reference

All `/api` and file routes require an authenticated session and operate only on files owned by the current user.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/dashboard` | List the current user's files. |
| `POST` | `/files` | Create a file and redirect to its canvas. |
| `POST` | `/files/:id/delete` | Delete a file. |
| `GET` | `/canvas/:id` | Render the editor for a file. |
| `GET` | `/api/files/:id` | Return a file's graph as JSON. |
| `PUT` | `/api/files/:id` | Replace a file's `name`, `nodes`, `edges`, and `view`. |

## Security notes

- Passwords are hashed with bcrypt; sessions are stored server-side in MongoDB and regenerated on login.
- Session cookies are `httpOnly`, `sameSite=lax`, and `secure` in production (behind `trust proxy`).
- Login and registration are rate-limited per IP (10 requests / 15 min).
- In production the global error handler returns a generic message and never leaks internal error details to clients.

## Deployment

The app runs as a standard long-lived Node process and deploys cleanly to any Node host. The live demo runs on [Render](https://render.com) with a MongoDB Atlas cluster:

- **Build command:** `npm install`
- **Start command:** `npm start`
- Set `NODE_ENV=production` and all required environment variables on the host.
- Whitelist the host in MongoDB Atlas **Network Access** (`0.0.0.0/0` if the platform has no static egress IP).
- Add the production `${BASE_URL}/auth/google/callback` to the Google OAuth client.

## License

ISC
