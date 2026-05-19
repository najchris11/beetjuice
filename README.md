# 🧃 beetjuice

A web UI for managing your [beets](https://beets.io/) music library. Browse albums, detect duplicates, compare audio quality, and clean up your collection — all from the browser.

Built as a companion to [beets-flask](https://github.com/pSpitzworker/beets-flask) (which handles importing). Beetjuice handles the other half: **browsing, duplicate awareness, and deletion**.

![React](https://img.shields.io/badge/React_18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

---

## Features

### 📚 Library Browser
- Album grid with cover art (deterministic gradient fallback when art is unavailable)
- Search by artist, album, or year
- Sort by artist, album name, or year (ascending/descending)
- Album detail view with full track listing and per-track metadata

### 🔍 Duplicate Detection
- Three-pass detection: MusicBrainz album ID → normalized name → fuzzy Levenshtein
- Side-by-side quality comparison highlighting differences in format, bitrate, sample rate, bit depth, and track count
- Filter by detection reason with group counts
- Collapsible detailed diff view

### 🗑️ Deletion
- Delete albums or individual tracks with confirmation dialogs
- Optimistic UI updates with automatic rollback on failure
- Toast notifications for success/error feedback
- Fallback deletion strategy (album-level → item-by-item)

### 📊 Stats & Settings
- Library overview with album/track counts
- Read-only configuration display

---

## Prerequisites

- **Node.js 20+**
- A running [beets](https://beets.io/) instance with the **web plugin enabled**:
  ```yaml
  # beets config.yaml
  web:
    host: 0.0.0.0
    port: 8337
    readonly: no    # required for deletion
  ```

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/najchris11/beetjuice.git
cd beetjuice
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env` and set `BEETS_API_URL` to point at your beets web plugin:

```env
BEETS_API_URL=http://192.168.1.x:8337
PORT=3001
```

### 3. Run (development)

In two terminals:

```bash
# Terminal 1 — backend (hot reload via tsx)
npm run dev:backend        # → http://localhost:3001

# Terminal 2 — frontend (Vite dev server, proxies /api to :3001)
npm run dev:frontend       # → http://localhost:5173
```

### 4. Build & run (production)

```bash
npm run build
npm start                  # serves both API and frontend on :3001
```

---

## Docker

```bash
docker build -t beetjuice .
docker run -d \
  -e BEETS_API_URL=http://192.168.1.x:8337 \
  -p 3001:3001 \
  beetjuice
```

### Unraid

| Variable        | Default      | Description                       |
|-----------------|--------------|-----------------------------------|
| `BEETS_API_URL` | *(required)* | URL of your beets web plugin      |
| `PORT`          | `3001`       | Port beetjuice listens on         |
| `PUID`          | `99`         | UID (Unraid `nobody`)             |
| `PGID`          | `100`        | GID (Unraid `users`)              |

No volume mounts required — beetjuice communicates with beets entirely over HTTP.

---

## Architecture

```
beetjuice/
├── backend/              # Express + TypeScript
│   └── src/
│       ├── routes/       # albums, items, duplicates, stats
│       ├── services/     # HTTP client for beets web plugin
│       ├── lib/          # duplicate detection logic
│       └── types/        # shared type definitions
├── frontend/             # React + Vite + Tailwind
│   └── src/
│       ├── components/   # Nav, AlbumCard, FormatBadge, etc.
│       ├── pages/        # Library, AlbumDetail, Duplicates, Stats, Settings
│       ├── hooks/        # TanStack Query wrappers + toast system
│       └── types/        # mirrored from backend
├── Dockerfile            # multi-stage (build + runtime)
└── package.json          # npm workspaces root
```

**Single container, two workspaces.** In production, Express serves both `/api/*` routes and the compiled React app as static files. In development, Vite runs separately and proxies `/api` to Express.

---

## API

All routes are prefixed `/api/`.

| Method   | Path                      | Description                          |
|----------|---------------------------|--------------------------------------|
| `GET`    | `/api/albums`             | All albums (enriched with metadata)  |
| `GET`    | `/api/albums/:id`         | Single album by beets ID             |
| `GET`    | `/api/albums/:id/art`     | Cover art (proxied, avoids CORS)     |
| `GET`    | `/api/albums/:id/items`   | All tracks for an album              |
| `DELETE` | `/api/albums/:id`         | Delete album + files                 |
| `GET`    | `/api/items`              | Search tracks (`?q=query`)           |
| `GET`    | `/api/items/:id`          | Single track by beets ID             |
| `DELETE` | `/api/items/:id`          | Delete track + file                  |
| `GET`    | `/api/duplicates`         | Albums grouped as duplicate sets     |
| `GET`    | `/api/stats`              | Album/track counts                   |

---

## Tech Stack

| Layer      | Choice                 | Why                                      |
|------------|------------------------|------------------------------------------|
| Frontend   | React 18 + TypeScript  | Component model, type safety             |
| Build      | Vite                   | Fast HMR, easy proxy config              |
| Styling    | Tailwind CSS v3        | Utility-first, quick iteration           |
| Routing    | React Router v6        | SPA client-side routing                  |
| Data       | TanStack Query v5      | Caching, loading/error states, mutations |
| Backend    | Express + TypeScript   | Thin proxy + duplicate detection logic   |
| Dedup      | fastest-levenshtein    | Fuzzy string matching for duplicates     |
| Runtime    | Node 20 (Alpine)       | Small Docker image, native fetch         |

---

## Known Issues

- **File deletion via web plugin**: `DELETE /album/{id}?delete` through the beets web plugin removes the database record but may not delete files from disk. This appears to be an upstream beets issue. The CLI command `beet remove -d` works correctly as a workaround.
- **Cover art**: Albums without embedded art or `cover.jpg` in their directory will show a generated gradient fallback.

---

## License

MIT
