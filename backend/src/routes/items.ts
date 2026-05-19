import { Router } from 'express'
import { beetsGet, beetsDelete } from '../services/beets.js'
import { deleteFile, musicPath } from '../lib/files.js'
import type { Item } from '../types/beets.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const q = req.query.q as string | undefined
    if (q) {
      const data = await beetsGet<{ results: Item[] }>(`/item/query/${encodeURIComponent(q)}`)
      res.json(data.results)
    } else {
      const data = await beetsGet<{ items: Item[] }>('/item/')
      res.json(data.items)
    }
  } catch (err) {
    res.status(502).json({ error: String(err) })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const data = await beetsGet<Item>(`/item/${req.params.id}`)
    res.json(data)
  } catch (err) {
    res.status(502).json({ error: String(err) })
  }
})

router.delete('/:id', async (req, res) => {
  const itemId = req.params.id
  try {
    // 1. Get the item to retrieve its file path
    const item = await beetsGet<Item>(`/item/${itemId}`)

    let fileDeleted = false
    if (musicPath() && item.path) {
      // 2. Delete the file from filesystem
      fileDeleted = await deleteFile(item.path)
      if (!fileDeleted) {
        console.warn(`DELETE /api/items/${itemId}: file not found on disk: ${item.path}`)
      }
    } else {
      console.warn(`DELETE /api/items/${itemId}: MUSIC_PATH not set — skipping file deletion`)
    }

    // 3. Remove from beets DB (no ?delete — we handled the file above)
    await beetsDelete(`/item/${itemId}`, false)

    console.log(`DELETE /api/items/${itemId}: ok (fileDeleted=${fileDeleted})`)
    res.json({ ok: true, fileDeleted })
  } catch (err) {
    console.error(`DELETE /api/items/${itemId} error:`, err)
    res.status(502).json({ error: String(err) })
  }
})

export default router
