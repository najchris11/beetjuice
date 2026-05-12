# beetjuice — Implementation Plan

A React + Express web app for managing a beets music library. Companion to beets-flask (which handles importing). Beetjuice handles library browsing, duplicate awareness, and deletion. Runs as a Docker container on Unraid.

---

## Architecture Overview

```
beetjuice/
├── backend/
│   └── src/
│       ├── routes/
│       │   ├── albums.ts       # GET/DELETE /api/albums/*
│       │   ├── items.ts        # GET/DELETE /api/items/*
│       │   └── duplicates.ts   # GET /api/duplicates
│       ├── services/
│       │   └── beets.ts        # HTTP client for beets web plugin
│       ├── lib/
│       │   └── duplicates.ts   # dedup grouping logic
│       ├── types/
│       │   └── beets.ts        # Album, Item, Stats types
│       └── index.ts
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Nav.tsx
│       │   ├── AlbumCard.tsx
│       │   ├── FormatBadge.tsx
│       │   └── ConfirmDialog.tsx
│       ├── pages/
│       │   ├── Library.tsx
│       │   ├── AlbumDetail.tsx
│       │   └── Duplicates.tsx
│       ├── hooks/
│       │   └── useBeets.ts     # TanStack Query wrappers
│       ├── types/
│       │   └── beets.ts        # mirrored from backend
│       ├── App.tsx
│       └── main.tsx
├── Dockerfile
├── .env.example
└── package.json                # npm workspaces root
```

**Single container, two workspaces.** In production, Express serves both `/api/*` and the compiled React app as static files. In dev, Vite runs separately and proxies `/api` to the Express server.

---

## Tech Stack

| Layer      | Choice                   | Reason                                    |
|------------|--------------------------|-------------------------------------------|
| Frontend   | React 18 + TypeScript    | User's preference                         |
| Build tool | Vite                     | Fast HMR, easy proxy config               |
| Styling    | Tailwind CSS v3          | Utility-first, quick to iterate           |
| Routing    | React Router v6          | SPA routing                               |
| Data fetch | TanStack Query v5        | Caching, loading/error states             |
| Backend    | Express + TypeScript     | Minimal CORS proxy + dupe logic           |
| Dedup      | fastest-levenshtein      | Same lib as collectr, no extra deps       |
| Runtime    | Node 20 (Alpine)         | Small image, native fetch                 |

---

## Infrastructure

### Beets Web Plugin
Must be enabled with `readonly: no` on the beets container:

```yaml
web:
  host: 0.0.0.0
  port: 8337
  readonly: no
```

### Deletion
The beets web plugin deletes files when the `?delete` query param is included:
- `DELETE /item/{id}?delete` — confirmed: removes DB record + file
- `DELETE /album/{id}?delete` — likely works; fallback is: fetch all item IDs for album → batch `DELETE /item/{id1},{id2},...?delete` → `DELETE /album/{id}`

No Docker socket, no SSH, no volume mounts required.

### Unraid Template Config

**Environment variables:**

| Variable        | Default      | Description                       |
|-----------------|--------------|-----------------------------------|
| `BEETS_API_URL` | *(required)* | e.g. `http://192.168.1.x:8337`   |
| `PORT`          | `3001`       | Port beetjuice listens on         |
| `PUID`          | `99`         | UID (Unraid nobody)               |
| `PGID`          | `100`        | GID (Unraid users)                |

**Volume mounts:** None required.

---

## API Contracts

All routes are prefixed `/api/`. The backend proxies to the beets web plugin and adds duplicate detection.

### Albums

| Method   | Path                    | Description                            |
|----------|-------------------------|----------------------------------------|
| `GET`    | `/api/albums`           | All albums                             |
| `GET`    | `/api/albums/:id`       | Single album by beets ID               |
| `GET`    | `/api/albums/:id/art`   | Cover art (proxied, avoids CORS)       |
| `GET`    | `/api/albums/:id/items` | All tracks for an album                |
| `DELETE` | `/api/albums/:id`       | Delete album + files                   |

### Items

| Method   | Path              | Description                              |
|----------|-------------------|------------------------------------------|
| `GET`    | `/api/items/:id`  | Single track by beets ID                 |
| `GET`    | `/api/items`      | Search tracks (`?q=beets-query-string`)  |
| `DELETE` | `/api/items/:id`  | Delete track + file                      |

### Other

| Method | Path               | Description                                        |
|--------|--------------------|----------------------------------------------------|
| `GET`  | `/api/duplicates`  | Albums grouped as duplicate sets                   |
| `GET`  | `/api/stats`       | Track/album counts (proxied from beets `/stats`)   |

---

## Data Models

```typescript
// backend/src/types/beets.ts (mirrored in frontend/src/types/beets.ts)

export interface Album {
  id: number
  album: string
  albumartist: string
  year: number
  genre: string
  mb_albumid: string       // MusicBrainz album ID
  artpath: string
  path: string             // directory on disk
}

export interface Item {
  id: number
  title: string
  artist: string
  albumartist: string
  album: string
  album_id: number
  track: number
  disc: number
  year: number
  genre: string
  format: string           // FLAC, MP3, DSD, ALAC, etc.
  bitrate: number          // bits per second
  samplerate: number       // Hz
  bitdepth: number
  length: number           // seconds
  path: string
  mb_trackid: string
  mb_albumid: string
}

export interface DuplicateGroup {
  reason: 'mb_albumid' | 'normalized_name' | 'fuzzy'
  copies: Album[]
}

export interface Stats {
  items: number
  albums: number
}
```

---

## Duplicate Detection Logic

Runs server-side in `backend/src/lib/duplicates.ts`. Three-pass grouping:

**Pass 1 — MusicBrainz album ID (exact)**
Group all albums sharing the same non-empty `mb_albumid`.

**Pass 2 — Normalized name (exact after normalization)**
For ungrouped albums: normalize `albumartist + album` (lowercase, strip punctuation, collapse whitespace). Group exact matches.

**Pass 3 — Fuzzy (Levenshtein)**
For still-ungrouped albums: compare normalized names pairwise. Group pairs with similarity ≥ 0.85.

Result: `DuplicateGroup[]` — no "canonical" designation. User decides what to keep.

**Key invariant:** DSD + FLAC of the same album will appear as a duplicate group. The tool surfaces it; it never auto-deletes.

---

## Dockerfile (multi-stage)

```
Stage 1 — build
  node:20-alpine
  npm ci (all workspaces)
  vite build → frontend/dist/
  tsc → backend/dist/

Stage 2 — runtime
  node:20-alpine
  apk add su-exec
  npm ci --omit=dev (backend only)
  COPY backend/dist, frontend/dist
  su-exec $PUID:$PGID node backend/dist/index.js
```

---

## Dev Workflow

```bash
# Install all deps
npm install

# Run backend (hot reload via tsx watch)
npm run dev -w backend        # → http://localhost:3001

# Run frontend (Vite dev server, proxies /api to :3001)
npm run dev -w frontend       # → http://localhost:5173

# Build everything
npm run build -w frontend
npm run build -w backend

# Docker build
docker build -t beetjuice .
docker run -e BEETS_API_URL=http://192.168.1.x:8337 -p 3001:3001 beetjuice
```

---

## Phased Build Order

### Phase 1 — Scaffold + Library Browser ✅
1. ✅ npm workspace root
2. ✅ Express backend with beets proxy
3. ✅ Vite + React + Tailwind + React Router frontend
4. ✅ Dockerfile (multi-stage)
5. ✅ Album list page: grid, cover art, search/filter by artist/album/year/format, sort controls
6. ✅ Album detail page: track list + metadata table (format, bitrate, sample rate, bit depth)

### Phase 2 — Duplicate Detection ✅
1. ✅ `backend/src/lib/duplicates.ts` — three-pass grouping with enriched AlbumSummary metadata
2. ✅ `GET /api/duplicates` endpoint with format/bitrate/quality data per copy
3. ✅ Duplicates page: side-by-side comparison with quality highlighting, collapsible detailed diff
4. ✅ Filter by detection reason (MusicBrainz / Name match / Fuzzy) with counts
5. ✅ Delete button wired per copy with rich confirmation

### Phase 3 — Deletion ✅
1. ✅ Backend delete endpoints with fallback (direct album delete → item-by-item fallback)
2. ✅ Verified `DELETE /album/{id}?delete` removes DB record + files (tested on album 1878)
3. ✅ Confirmation modal shows name, artist, format, track count, bitrate
4. ✅ Optimistic UI update (instant removal from cache, rollback on failure)
5. ✅ Toast notifications for success/error feedback

### Phase 4 — Polish
1. Loading skeletons, error states
2. Stats page
3. Settings panel (read-only config display)

---

## Backburner: Playlist Import (M3U)

> Do not implement until Phases 1–3 are solid.

**Goal:** Import an M3U playlist. Match each track against the beets library by MusicBrainz ID or fuzzy artist+title; substitute library copy paths. Flag unmatched tracks.

**Reference:** `/Users/najchris11/GitHub/collectr`
- M3U parsing: `src/playlist/m3u.ts`
- Matching cascade (MB ID → fuzzy Levenshtein): `src/matcher/`

**Navidrome:** Write resolved M3U to Navidrome's playlist directory → appears automatically, no API needed.

---

## Assumptions & Known Unknowns

- `DELETE /album/{id}?delete` file behaviour needs one-time verification; fallback implemented regardless
- Beets web plugin confirmed running on port 8337 with `host: 0.0.0.0`; confirmed `readonly: no` needed
- PUID/PGID 99/100 standard for Unraid
