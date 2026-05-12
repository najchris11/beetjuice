---
name: beetjuice project context
description: Goals, stack, and constraints for the beetjuice beets library manager app
type: project
---

Beetjuice is a React + Express local web app for managing a beets music library. It's a companion to beets-flask (which handles importing) — beetjuice handles browsing, duplicate awareness, and deletion.

**Why:** beets-flask is great for importing but not ergonomic for library management (dupes, deletion, browsing).

**Stack:** React + TypeScript (Vite) + Tailwind frontend, Express + TypeScript backend (thin CORS proxy over beets web plugin API), TanStack Query, React Router v6, npm workspaces.

**Key constraints:**
- Beets web plugin must be enabled with `readonly: false` on the Unraid server
- `DELETE /album/{id}` via web plugin only removes DB record, NOT files — backend must shell out to `beet remove -d` for true file deletion
- No auth needed (local only)
- Docker-ready in future but local-first for now

**Duplicate detection:** Surface groups (not auto-delete) — MusicBrainz album ID → normalized artist+album name → fuzzy Levenshtein. User explicitly chose NOT to auto-delete since DSD + FLAC of same album is intentional.

**Playlist import (backburner):** M3U import that substitutes library copies for matched tracks. Reference: `/Users/najchris11/GitHub/collectr` (has M3U parsing + MusicBrainz/fuzzy matching already built). Navidrome reads M3U from disk so no API needed there.

**Plan doc:** `/Users/najchris11/GitHub/beetjuice/PLAN.md`

**Why:** User wants to manage their beets library more easily — find dupes, browse, delete specific album IDs (safe for dupes since name-based delete would hit both copies).
**How to apply:** When building features, follow the phased order in PLAN.md. Always confirm before file-deleting operations.
