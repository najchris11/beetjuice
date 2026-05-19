import { Router } from 'express'
import fs from 'node:fs/promises'
import { beetsGet, beetsDelete } from '../services/beets.js'
import { deleteFile, musicPath } from '../lib/files.js'
import { logger } from '../lib/logger.js'
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
    const mp = musicPath()
    if (mp && item.path) {
      // Safety: refuse to delete anything outside MUSIC_PATH
      if (!item.path.startsWith(mp)) {
        logger.warn(`item ${itemId}: path "${item.path}" is outside MUSIC_PATH "${mp}" — skipping file deletion`)
      } else {
        // Verify the file actually exists before deleting
        try {
          await fs.access(item.path, fs.constants.F_OK)
          fileDeleted = await deleteFile(item.path)
        } catch {
          logger.warn(`item ${itemId}: file not found at ${item.path} — removing from DB only`)
        }
      }
    } else if (!mp) {
      logger.warn(`item ${itemId}: MUSIC_PATH not set — skipping file deletion, DB record only`)
    } else {
      logger.warn(`item ${itemId}: beets returned no path — skipping file deletion, DB record only`)
    }

    // 3. Remove from beets DB (no ?delete — we handled the file above)
    await beetsDelete(`/item/${itemId}`, false)

    logger.info(`deleted item ${itemId} "${item.title}" by ${item.artist} (file=${fileDeleted})`)
    res.json({ ok: true, fileDeleted })
  } catch (err) {
    logger.error(`delete item ${itemId} failed: ${String(err)}`)
    res.status(502).json({ error: String(err) })
  }
})

export default router
