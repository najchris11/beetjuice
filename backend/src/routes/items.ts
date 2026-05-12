import { Router } from 'express'
import { beetsGet, beetsDelete } from '../services/beets.js'
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
  try {
    await beetsDelete(`/item/${req.params.id}`, true)
    res.status(204).end()
  } catch (err) {
    res.status(502).json({ error: String(err) })
  }
})

export default router
