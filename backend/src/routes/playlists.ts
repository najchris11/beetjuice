import { Router } from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { beetsGet } from '../services/beets.js'
import { libraryPath, musicPath } from '../lib/files.js'
import { logger } from '../lib/logger.js'
import { cache, ALBUMS_TTL } from '../lib/cache.js'
import { parseM3u, buildM3u } from '../lib/m3u.js'
import { matchItems } from '../lib/matcher.js'
import { readFileTagsBatch } from '../lib/tags.js'
import { postPlaylistToNavidrome, testNavidromeConnection } from '../lib/navidrome.js'
import type { Item, } from '../types/beets.js'
import type { ExportRequest, ExportResult, ParsedEntry, TrackSelection } from '../types/playlists.js'

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
  // Try BEETS_LIBRARY_PATH first (clean tracks), then MUSIC_PATH (staged files outside clean library)
  for (const root of [libraryPath(), musicPath()]) {
    if (root && absolutePath.startsWith(root)) {
      return absolutePath.slice(root.length).replace(/^\/+/, '')
    }
  }
  return null
}

router.post('/import', async (req, res) => {
  const { content, filename, filePath } = req.body as { content?: string; filename?: string; filePath?: string }

  try {
    let entries: ParsedEntry[]
    let label: string

    if (filePath) {
      // Server-side: read the M3U from disk, resolve audio file paths, read their tags
      const mp = musicPath()
      if (!mp) {
        res.status(503).json({ error: 'MUSIC_PATH not configured' })
        return
      }
      // Accept either an absolute path or a path relative to MUSIC_PATH
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(mp, filePath)
      if (!absolutePath.startsWith(mp)) {
        res.status(400).json({ error: 'filePath must be within MUSIC_PATH' })
        return
      }
      const m3uContent = await fs.readFile(absolutePath, 'utf-8')
      const raw = parseM3u(m3uContent)
      const m3uDir = path.dirname(absolutePath)
      entries = await enrichEntriesFromFiles(raw, m3uDir)
      label = path.basename(absolutePath)
    } else if (content) {
      // Client-side upload: use EXTINF metadata only (no file access)
      entries = parseM3u(content)
      label = filename ?? 'unknown'
    } else {
      res.status(400).json({ error: 'Missing filePath or content' })
      return
    }

    if (entries.length === 0) {
      res.json([])
      return
    }

    const items = await getAllItems()
    const results = matchItems(entries, items)

    logger.info(`playlist import "${label}": ${entries.length} entries → ${results.filter(r => r.status === 'matched').length} matched, ${results.filter(r => r.status === 'low_confidence').length} low confidence, ${results.filter(r => r.status === 'unmatched').length} unmatched`)
    res.json(results)
  } catch (err) {
    logger.error(`playlist import failed: ${String(err)}`)
    res.status(502).json({ error: String(err) })
  }
})

async function enrichEntriesFromFiles(entries: ParsedEntry[], m3uDir: string): Promise<ParsedEntry[]> {
  // Resolve each entry's file path (absolute or relative to M3U directory)
  const resolved = entries.map(e => {
    const p = e.originalPath
    if (!p) return null
    return path.isAbsolute(p) ? p : path.resolve(m3uDir, p)
  })

  const tags = await readFileTagsBatch(resolved.map(p => p ?? ''))

  return entries.map((e, i) => {
    const t = tags[i]
    const filePath = resolved[i]
    return {
      ...e,
      resolvedFilePath: filePath,
      title: t?.title ?? e.title,
      artist: t?.artist ?? e.artist,
      album: t?.album ?? e.album,
      mbTrackId: t?.mbTrackId ?? e.mbTrackId,
    }
  })
}

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
  // Staging lives under MUSIC_PATH when available, falling back to the library root
  const stagingRoot = mp || lib
  const sourceRoot = mp || lib || null
  const stagingDir = stagingRoot ? path.join(stagingRoot, stagingFolder, sanitizeFilename(playlistName)) : null

  const result: ExportResult = {
    ok: false,
    postedToNavidrome: false,
    stagedFiles: 0,
    skippedFiles: 0,
  }

  // Resolve each track to a relative path, staging unmatched files as needed
  const resolved: { title: string; artist: string; duration: number | null; relativePath: string }[] = []

  for (const track of tracks) {
    const rel = await resolveTrackPath(track, sourceRoot, stagingDir, result)
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
  if (navidrome.url && navidrome.username && navidrome.password) {
    try {
      await postPlaylistToNavidrome(navidrome.url, navidrome.username, navidrome.password, playlistName, m3uContent)
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
  const { url, username, password } = req.body as { url?: string; username?: string; password?: string }
  if (!url || !username || !password) {
    res.status(400).json({ error: 'Missing url, username, or password' })
    return
  }
  const result = await testNavidromeConnection(url, username, password)
  res.json(result)
})

router.get('/dirs', async (req, res) => {
  // root=music → browse from MUSIC_PATH; root=library (default) → BEETS_LIBRARY_PATH
  const useMusic = req.query.root === 'music'
  const root = useMusic ? musicPath() : libraryPath()
  const rootLabel = useMusic ? 'MUSIC_PATH' : 'BEETS_LIBRARY_PATH'

  if (!root) {
    res.status(503).json({ error: `${rootLabel} not configured` })
    return
  }

  const subpath = (req.query.path as string) ?? ''
  const parts = subpath.split('/').filter(p => p && p !== '..' && p !== '.')
  const safeSub = parts.join('/')
  const targetDir = safeSub ? path.join(root, safeSub) : root

  if (!targetDir.startsWith(root)) {
    res.status(400).json({ error: 'Path outside root' })
    return
  }

  const includeFiles = req.query.files === 'm3u'

  try {
    const entries = await fs.readdir(targetDir, { withFileTypes: true })
    const dirs = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name)
      .sort()
    const files = includeFiles
      ? entries
          .filter(e => e.isFile() && /\.m3u8?$/i.test(e.name))
          .map(e => e.name)
          .sort()
      : undefined
    res.json({ dirs, files, current: safeSub })
  } catch {
    res.json({ dirs: [], files: includeFiles ? [] : undefined, current: safeSub })
  }
})

async function resolveTrackPath(
  track: TrackSelection,
  sourceRoot: string | null,
  stagingDir: string | null,
  result: ExportResult,
): Promise<string | null> {
  if (track.mode === 'library') {
    if (!track.itemPath) {
      logger.warn(`track "${track.title}" has no library path — skipping`)
      result.skippedFiles++
      return null
    }
    const rel = makeRelative(track.itemPath)
    if (rel) return rel
    logger.warn(`track "${track.title}" has path outside library — skipping`)
    result.skippedFiles++
    return null
  }

  if (!track.sourcePath || !stagingDir || !sourceRoot) {
    logger.warn(`track "${track.title}" cannot be staged — missing source path or staging root`)
    result.skippedFiles++
    return null
  }

  // Safety check: source must stay within the chosen staging root
  if (!track.sourcePath.startsWith(sourceRoot)) {
    logger.warn(`staging source "${track.sourcePath}" outside staging root "${sourceRoot}" — skipping`)
    result.skippedFiles++
    return null
  }

  try {
    await fs.mkdir(stagingDir, { recursive: true })
    const stagedAudio = await moveFile(track.sourcePath, path.join(stagingDir, path.basename(track.sourcePath)))
    await moveSidecarLrc(track.sourcePath, stagingDir)
    const rel = makeRelative(stagedAudio)
    if (rel) {
      result.stagedFiles++
      return rel
    }
  } catch (err) {
    logger.warn(`failed to stage "${track.sourcePath}": ${String(err)}`)
    result.skippedFiles++
  }

  return null
}

async function moveSidecarLrc(sourcePath: string, stagingDir: string): Promise<void> {
  const sidecarSource = sourcePath.replace(/\.[^.\/]+$/, '.lrc')
  try {
    await fs.access(sidecarSource)
  } catch {
    return
  }
  const sidecarDest = path.join(stagingDir, path.basename(sidecarSource))
  await moveFile(sidecarSource, sidecarDest)
}

async function moveFile(sourcePath: string, destPath: string): Promise<string> {
  await fs.rm(destPath, { force: true })
  try {
    await fs.rename(sourcePath, destPath)
  } catch (err) {
    const code = typeof err === 'object' && err && 'code' in err ? (err as NodeJS.ErrnoException).code : undefined
    if (code !== 'EXDEV') {
      throw err
    }
    await fs.copyFile(sourcePath, destPath)
    await fs.unlink(sourcePath)
  }
  return destPath
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').trim()
}

export default router
