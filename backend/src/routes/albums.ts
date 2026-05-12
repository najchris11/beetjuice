import { Router } from 'express'
import { beetsGet, beetsDelete, beetsGetRaw } from '../services/beets.js'
import type { Album, Item } from '../types/beets.js'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const data = await beetsGet<{ albums: Album[] }>('/album/')
    console.log('beets /album/ response keys:', Object.keys(data ?? {}))
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
  try {
    await beetsDelete(`/album/${req.params.id}`, true)
    res.status(204).end()
  } catch (err) {
    res.status(502).json({ error: String(err) })
  }
})

export default router
