import { Router } from 'express'
import { beetsGet } from '../services/beets.js'
import { findDuplicates } from '../lib/duplicates.js'
import type { Album, Item } from '../types/beets.js'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const [albumData, itemData] = await Promise.all([
      beetsGet<{ albums: Album[] }>('/album/'),
      beetsGet<{ items: Item[] }>('/item/'),
    ])
    const groups = findDuplicates(albumData.albums, itemData.items)
    res.json(groups)
  } catch (err) {
    console.error('GET /api/duplicates error:', err)
    res.status(502).json({ error: String(err) })
  }
})

export default router
