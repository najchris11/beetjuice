import { Router } from 'express'
import { beetsGet, beetsDelete, beetsGetRaw } from '../services/beets.js'
import { enrichAlbum } from '../lib/duplicates.js'
import { deleteDir, readArtwork, musicPath } from '../lib/files.js'
import type { Album, Item, AlbumSummary } from '../types/beets.js'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const [albumData, itemData] = await Promise.all([
      beetsGet<{ albums: Album[] }>('/album/'),
      beetsGet<{ items: Item[] }>('/item/'),
    ])
    const albums = albumData.albums ?? albumData
    const items = itemData.items ?? itemData
    const enriched = albums.map(a => enrichAlbum(a, items)) as AlbumSummary[]
    res.json(enriched)
  } catch (err) {
    console.error('GET /api/albums error:', err)
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
    // 1. Get the album to retrieve its directory path
    const album = await beetsGet<Album>(`/album/${albumId}`)

    let filesDeleted = false
    if (musicPath() && album.path) {
      // 2a. Delete album directory from filesystem (covers tracks + artwork + any other files)
      filesDeleted = await deleteDir(album.path)
      if (!filesDeleted) {
        console.warn(`DELETE /api/albums/${albumId}: directory not found on disk: ${album.path}`)
      }
    } else {
      console.warn(`DELETE /api/albums/${albumId}: MUSIC_PATH not set — skipping file deletion`)
    }

    // 3. Remove from beets DB (no ?delete — we handled files above)
    try {
      await beetsDelete(`/album/${albumId}`, false)
    } catch {
      // Album record may already be gone if beets auto-cleaned after items were removed
    }

    console.log(`DELETE /api/albums/${albumId}: ok (filesDeleted=${filesDeleted})`)
    res.json({ ok: true, filesDeleted })
  } catch (err) {
    console.error(`DELETE /api/albums/${albumId}: failed`, err)
    res.status(502).json({ error: `Failed to delete album: ${String(err)}` })
  }
})

export default router
