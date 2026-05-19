import { Router } from 'express'
import { beetsGet, beetsDelete, beetsGetRaw } from '../services/beets.js'
import { enrichAlbum } from '../lib/duplicates.js'
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
    // Workaround: beets Album.remove(delete=True) has a bug where it deletes
    // the album DB row before iterating items, causing self.items() to return
    // empty and skipping file deletion entirely. Instead, we delete each item
    // individually (which correctly removes files), then clean up the album record.
    // See: https://github.com/beetbox/beets/issues/XXXX

    // 1. Get all items for this album
    const data = await beetsGet<{ results: Item[] }>(`/item/query/album_id:${albumId}`)
    const items = data.results ?? []

    // 2. Delete each item with ?delete (removes DB record + file from disk)
    const itemResults = await Promise.allSettled(
      items.map(item => beetsDelete(`/item/${item.id}`, true))
    )
    const failedItems = itemResults.filter(r => r.status === 'rejected')
    if (failedItems.length > 0) {
      console.warn(`DELETE /api/albums/${albumId}: ${failedItems.length}/${items.length} item deletes failed`)
    }

    // 3. Clean up the album record (no ?delete needed — files already handled)
    try {
      await beetsDelete(`/album/${albumId}`, false)
    } catch {
      // Album record might already be gone if beets auto-cleaned it after last item was removed
    }

    console.log(`DELETE /api/albums/${albumId}: deleted ${items.length - failedItems.length}/${items.length} items`)
    res.json({
      ok: true,
      itemsDeleted: items.length - failedItems.length,
      itemsFailed: failedItems.length,
    })
  } catch (err) {
    console.error(`DELETE /api/albums/${albumId}: failed`, err)
    res.status(502).json({ error: `Failed to delete album: ${String(err)}` })
  }
})

export default router
