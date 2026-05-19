import { Router } from 'express'
import { beetsGet } from '../services/beets.js'
import { findDuplicates } from '../lib/duplicates.js'
import { logger } from '../lib/logger.js'
import { cache, DUPES_TTL } from '../lib/cache.js'
import type { Album, Item, DuplicateGroup } from '../types/beets.js'

const router = Router()

router.get('/', async (_req, res) => {
  const cached = cache.get<DuplicateGroup[]>('duplicates')
  if (cached) {
    res.json(cached)
    return
  }
  try {
    const [albumData, itemData] = await Promise.all([
      beetsGet<{ albums: Album[] }>('/album/'),
      beetsGet<{ items: Item[] }>('/item/'),
    ])
    const groups = findDuplicates(albumData.albums, itemData.items)
    cache.set('duplicates', groups, DUPES_TTL)
    res.json(groups)
  } catch (err) {
    logger.error(`GET /api/duplicates: ${String(err)}`)
    res.status(502).json({ error: String(err) })
  }
})

export default router
