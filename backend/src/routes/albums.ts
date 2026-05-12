import { Router } from 'express'
import { beetsGet, beetsDelete, beetsGetRaw } from '../services/beets.js'
import type { Album, Item } from '../types/beets.js'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const data = await beetsGet<{ albums: Album[] }>('/album/')
    res.json(data.albums ?? data)
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
    // First, try the direct album delete with ?delete (removes DB + files)
    await beetsDelete(`/album/${albumId}`, true)
    console.log(`DELETE /api/albums/${albumId}: album deleted via direct DELETE`)
    res.json({ ok: true, method: 'direct' })
  } catch (directErr) {
    // Fallback: delete each item individually, then remove the album record
    console.warn(`DELETE /api/albums/${albumId}: direct album delete failed, trying item-by-item fallback...`, directErr)
    try {
      const data = await beetsGet<{ results: Item[] }>(`/item/query/album_id:${albumId}`)
      const items = data.results ?? []

      // Delete each item (with file deletion)
      const itemResults = await Promise.allSettled(
        items.map(item => beetsDelete(`/item/${item.id}`, true))
      )
      const failedItems = itemResults.filter(r => r.status === 'rejected')
      if (failedItems.length > 0) {
        console.warn(`DELETE /api/albums/${albumId}: ${failedItems.length}/${items.length} item deletes failed`)
      }

      // Now delete the album record itself (without ?delete since files are already gone)
      try {
        await beetsDelete(`/album/${albumId}`, false)
      } catch {
        // Album record might already be gone if beets auto-cleaned it
        console.warn(`DELETE /api/albums/${albumId}: album record cleanup failed (may already be removed)`)
      }

      console.log(`DELETE /api/albums/${albumId}: album deleted via fallback (${items.length - failedItems.length}/${items.length} items removed)`)
      res.json({
        ok: true,
        method: 'fallback',
        itemsDeleted: items.length - failedItems.length,
        itemsFailed: failedItems.length,
      })
    } catch (fallbackErr) {
      console.error(`DELETE /api/albums/${albumId}: both direct and fallback delete failed`, fallbackErr)
      res.status(502).json({
        error: `Failed to delete album: ${String(fallbackErr)}`,
        directError: String(directErr),
      })
    }
  }
})

export default router
