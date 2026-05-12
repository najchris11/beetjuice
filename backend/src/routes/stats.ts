import { Router } from 'express'
import { beetsGet } from '../services/beets.js'
import type { Stats } from '../types/beets.js'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const data = await beetsGet<Stats>('/stats')
    res.json(data)
  } catch (err) {
    res.status(502).json({ error: String(err) })
  }
})

export default router
