import { Router } from 'express'
import fs from 'node:fs/promises'
import { beetsGet, beetsDelete, beetsGetRaw } from '../services/beets.js'
import { enrichAlbum } from '../lib/duplicates.js'
import { deleteDir, deleteFile, readArtwork, musicPath, resolvePath } from '../lib/files.js'
import { logger } from '../lib/logger.js'
import { cache, ALBUMS_TTL } from '../lib/cache.js'
import type { Album, Item, AlbumSummary } from '../types/beets.js'

const router = Router()

router.get('/', async (_req, res) => {
  const cached = cache.get<AlbumSummary[]>('albums')
  if (cached) {
    res.json(cached)
    return
  }
  try {
    const [albumData, itemData] = await Promise.all([
      beetsGet<{ albums: Album[] }>('/album/'),
      beetsGet<{ items: Item[] }>('/item/'),
    ])
    const albums = albumData.albums ?? albumData
    const items = itemData.items ?? itemData
    const enriched = albums.map(a => enrichAlbum(a, items)) as AlbumSummary[]

    // For albums where beets has no size data, stat the actual files from disk
    const mp = musicPath()
    if (mp) {
      const itemsByAlbum = new Map<number, Item[]>()
      for (const item of items) {
        const list = itemsByAlbum.get(item.album_id) ?? []
        list.push(item)
        itemsByAlbum.set(item.album_id, list)
      }

      const diskSizes = new Map<number, number>()
      const statTasks: Promise<void>[] = []
      for (const album of enriched) {
        if (album.totalSize !== 0) continue
        for (const item of itemsByAlbum.get(album.id) ?? []) {
          if (!item.path) continue
          const resolved = resolvePath(item.path)
          if (!resolved.startsWith(mp)) continue
          statTasks.push(
            fs.stat(resolved)
              .then(s => { diskSizes.set(album.id, (diskSizes.get(album.id) ?? 0) + s.size) })
              .catch(() => {})
          )
        }
      }
      await Promise.all(statTasks)
      for (const album of enriched) {
        const size = diskSizes.get(album.id)
        if (size) album.totalSize = size
      }
    }

    cache.set('albums', enriched, ALBUMS_TTL)
    res.json(enriched)
  } catch (err) {
    logger.error(`GET /api/albums: ${String(err)}`)
    res.status(502).json({ error: String(err) })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const data = await beetsGet<Album>(`/album/${req.params.id}`)
    res.json(data)
  } catch (err) {
    res.status(502).json({ error: String(err) })
  }
})

router.get('/:id/art', async (req, res) => {
  // Prefer serving artwork directly from the mounted filesystem (faster, no proxy hop)
  if (musicPath()) {
    try {
      const album = await beetsGet<Album>(`/album/${req.params.id}`)
      if (album.artpath) {
        const art = await readArtwork(album.artpath)
        if (art) {
          res.set('Content-Type', art.contentType)
          res.set('Cache-Control', 'public, max-age=86400')
          res.send(art.data)
          return
        }
      }
    } catch {
      // fall through to beets proxy
    }
  }
  // Fall back to beets web plugin proxy
  try {
    const upstream = await beetsGetRaw(`/album/${req.params.id}/art`)
    res.set('Content-Type', upstream.headers.get('content-type') ?? 'image/jpeg')
    res.set('Cache-Control', 'public, max-age=86400')
    const buf = await upstream.arrayBuffer()
    res.send(Buffer.from(buf))
  } catch {
    res.status(404).end()
  }
})

router.get('/:id/items', async (req, res) => {
  try {
    const data = await beetsGet<{ results: Item[] }>(`/item/query/album_id:${req.params.id}`)
    res.json(data.results)
  } catch (err) {
    res.status(502).json({ error: String(err) })
  }
})

router.delete('/:id', async (req, res) => {
  const albumId = req.params.id
  try {
    const album = await beetsGet<Album>(`/album/${albumId}`)

    let filesDeleted = false
    const mp = musicPath()

    if (!mp) {
      logger.warn(`album ${albumId}: MUSIC_PATH not set — skipping file deletion, DB record only`)
    } else if (album.path) {
      // Happy path: album has a directory path — delete the whole directory at once
      const resolvedPath = resolvePath(album.path)
      if (!resolvedPath.startsWith(mp)) {
        logger.warn(`album ${albumId}: resolved path "${resolvedPath}" is outside MUSIC_PATH "${mp}" — skipping file deletion`)
      } else {
        filesDeleted = await deleteDir(resolvedPath)
        if (!filesDeleted) {
          logger.warn(`album ${albumId}: directory not found at ${resolvedPath} — falling back to item-by-item deletion`)
        }
      }
    }

    // Fallback: album had no path, or its directory didn't exist — delete files item by item
    if (!filesDeleted && mp) {
      const itemData = await beetsGet<{ results: Item[] }>(`/item/query/album_id:${albumId}`)
      const items = itemData.results ?? []
      if (items.length === 0) {
        logger.warn(`album ${albumId}: beets returned no path and no items — DB record only`)
      } else {
        logger.info(`album ${albumId}: no album path — deleting ${items.length} item file(s) individually`)
        let dirToRemove: string | undefined
        let deletedCount = 0
        await Promise.all(items.map(async item => {
          if (!item.path) return
          const resolvedPath = resolvePath(item.path)
          if (!resolvedPath.startsWith(mp)) {
            logger.warn(`album ${albumId} item ${item.id}: path outside MUSIC_PATH — skipping`)
            return
          }
          const deleted = await deleteFile(resolvedPath)
          if (deleted) {
            deletedCount++
            dirToRemove ??= resolvedPath.substring(0, resolvedPath.lastIndexOf('/'))
          } else {
            logger.warn(`album ${albumId} item ${item.id}: file not found at ${resolvedPath}`)
          }
        }))
        // Remove the (now-empty) album directory if all files came from the same dir
        if (dirToRemove && dirToRemove.startsWith(mp)) {
          try {
            await fs.rmdir(dirToRemove)
            logger.info(`album ${albumId}: removed empty directory ${dirToRemove}`)
          } catch {
            // Non-empty or already gone — not an error
          }
        }
        filesDeleted = deletedCount > 0
        logger.info(`album ${albumId}: deleted ${deletedCount}/${items.length} item files`)
      }
    }

    // Remove from beets DB (no ?delete — we handled files above)
    try {
      await beetsDelete(`/album/${albumId}`, false)
    } catch {
      // Album record may already be gone
    }

    cache.invalidate('albums', 'duplicates')
    logger.info(`deleted album ${albumId} "${album.album}" by ${album.albumartist} (files=${filesDeleted})`)
    res.json({ ok: true, filesDeleted })
  } catch (err) {
    logger.error(`delete album ${albumId} failed: ${String(err)}`)
    res.status(502).json({ error: `Failed to delete album: ${String(err)}` })
  }
})

export default router
