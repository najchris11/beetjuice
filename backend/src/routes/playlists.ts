import { Router } from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { beetsGet } from '../services/beets.js'
import { libraryPath, musicPath } from '../lib/files.js'
import { logger } from '../lib/logger.js'
import { cache, ALBUMS_TTL } from '../lib/cache.js'
import { parseM3u, buildM3u } from '../lib/m3u.js'
import { matchItems } from '../lib/matcher.js'
import { postPlaylistToNavidrome, testNavidromeConnection } from '../lib/navidrome.js'
import type { Item } from '../types/beets.js'
import type { ExportRequest, ExportResult, TrackSelection } from '../types/playlists.js'

const router = Router()

async function getAllItems(): Promise<Item[]> {
  const cached = cache.get<Item[]>('items')
  if (cached) return cached
  const data = await beetsGet<{ items: Item[] }>('/item/')
  const items = data.items ?? (data as unknown as Item[])
  cache.set('items', items, ALBUMS_TTL)
  return items
}

function makeRelative(absolutePath: string): string | null {
  const lib = libraryPath()
  if (!lib) return absolutePath
  if (absolutePath.startsWith(lib)) {
    return absolutePath.slice(lib.length).replace(/^\/+/, '')
  }
  return null
}

router.post('/import', async (req, res) => {
  const { content, filename } = req.body as { content?: string; filename?: string }
  if (!content) {
    res.status(400).json({ error: 'Missing M3U content' })
    return
  }

  try {
    const entries = parseM3u(content)
    if (entries.length === 0) {
      res.json([])
      return
    }

    const items = await getAllItems()
    const results = matchItems(entries, items)

    logger.info(`playlist import "${filename ?? 'unknown'}": ${entries.length} entries → ${results.filter(r => r.status === 'matched').length} matched, ${results.filter(r => r.status === 'low_confidence').length} low confidence, ${results.filter(r => r.status === 'unmatched').length} unmatched`)
    res.json(results)
  } catch (err) {
    logger.error(`playlist import failed: ${String(err)}`)
    res.status(502).json({ error: String(err) })
  }
})

router.post('/export', async (req, res) => {
  const body = req.body as ExportRequest
  const { playlistName, tracks, navidrome } = body

  if (!playlistName || !tracks || tracks.length === 0) {
    res.status(400).json({ error: 'Missing playlistName or tracks' })
    return
  }

  const lib = libraryPath()
  const mp = musicPath()
  const stagingFolder = navidrome.stagingFolder || '_import'
  const stagingDir = lib ? path.join(lib, stagingFolder) : null

  const result: ExportResult = {
    ok: false,
    postedToNavidrome: false,
    stagedFiles: 0,
    skippedFiles: 0,
  }

  // Resolve each track to a relative path, staging unmatched files as needed
  const resolved: { title: string; artist: string; duration: number | null; relativePath: string }[] = []

  for (const track of tracks) {
    const rel = await resolveTrackPath(track, lib, mp, stagingDir, result)
    if (rel) {
      resolved.push({ title: track.title, artist: track.artist, duration: track.duration, relativePath: rel })
    }
  }

  if (resolved.length === 0) {
    res.status(400).json({ error: 'No tracks could be resolved to valid paths' })
    return
  }

  const m3uContent = buildM3u(resolved)

  // Filesystem write
  if (navidrome.playlistsPath && lib) {
    try {
      const playlistDir = path.join(lib, navidrome.playlistsPath)
      await fs.mkdir(playlistDir, { recursive: true })
      const outPath = path.join(playlistDir, `${sanitizeFilename(playlistName)}.m3u`)
      await fs.writeFile(outPath, m3uContent, 'utf-8')
      result.writtenTo = outPath
      logger.info(`playlist "${playlistName}" written to ${outPath}`)
    } catch (err) {
      logger.error(`playlist filesystem write failed: ${String(err)}`)
    }
  }

  // Navidrome API
  if (navidrome.url && navidrome.token) {
    try {
      await postPlaylistToNavidrome(navidrome.url, navidrome.token, playlistName, m3uContent)
      result.postedToNavidrome = true
      logger.info(`playlist "${playlistName}" posted to Navidrome`)
    } catch (err) {
      logger.error(`Navidrome API post failed: ${String(err)}`)
    }
  }

  result.ok = !!result.writtenTo || result.postedToNavidrome
  res.json(result)
})

router.post('/test-navidrome', async (req, res) => {
  const { url, token } = req.body as { url?: string; token?: string }
  if (!url || !token) {
    res.status(400).json({ error: 'Missing url or token' })
    return
  }
  const result = await testNavidromeConnection(url, token)
  res.json(result)
})

async function resolveTrackPath(
  track: TrackSelection,
  lib: string | null,
  mp: string | undefined,
  stagingDir: string | null,
  result: ExportResult,
): Promise<string | null> {
  if (track.itemPath) {
    const rel = makeRelative(track.itemPath)
    if (rel) return rel
    logger.warn(`track "${track.title}" has path outside library — skipping`)
    result.skippedFiles++
    return null
  }

  if (track.sourcePath && stagingDir && lib && mp) {
    // Safety check: source must be within MUSIC_PATH
    if (!track.sourcePath.startsWith(mp)) {
      logger.warn(`staging source "${track.sourcePath}" outside MUSIC_PATH — skipping`)
      result.skippedFiles++
      return null
    }
    try {
      await fs.mkdir(stagingDir, { recursive: true })
      const dest = path.join(stagingDir, path.basename(track.sourcePath))
      await fs.copyFile(track.sourcePath, dest)
      const rel = makeRelative(dest)
      if (rel) {
        result.stagedFiles++
        return rel
      }
    } catch (err) {
      logger.warn(`failed to stage "${track.sourcePath}": ${String(err)}`)
      result.skippedFiles++
    }
  }

  return null
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').trim()
}

export default router
