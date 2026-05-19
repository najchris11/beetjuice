import { Router } from 'express'
import { beetsGet } from '../services/beets.js'
import { cache } from '../lib/cache.js'
import type { Stats, AlbumSummary } from '../types/beets.js'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const data = await beetsGet<Stats>('/stats')

    // Enrich with aggregates from the albums cache when warm
    const albums = cache.get<AlbumSummary[]>('albums')
    if (albums) {
      data.totalSize = albums.reduce((s, a) => s + (a.totalSize ?? 0), 0)
      data.totalDuration = albums.reduce((s, a) => s + (a.totalDuration ?? 0), 0)

      // Count tracks by primary format (best approximation without per-track data)
      const formatCounts: Record<string, number> = {}
      for (const album of albums) {
        if (album.primaryFormat) {
          formatCounts[album.primaryFormat] = (formatCounts[album.primaryFormat] ?? 0) + album.trackCount
        }
      }
      data.formatCounts = formatCounts
    }

    res.json(data)
  } catch (err) {
    res.status(502).json({ error: String(err) })
  }
})

export default router
