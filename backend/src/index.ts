import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import albumRoutes from './routes/albums.js'
import itemRoutes from './routes/items.js'
import duplicateRoutes from './routes/duplicates.js'
import statsRoutes from './routes/stats.js'

const app = express()
const PORT = process.env.PORT ?? 3001
const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.use(cors())
app.use(express.json())

app.use('/api/albums', albumRoutes)
app.use('/api/items', itemRoutes)
app.use('/api/duplicates', duplicateRoutes)
app.use('/api/stats', statsRoutes)

app.get('/api/config', (_req, res) => {
  res.json({
    beetsApiUrl: process.env.BEETS_API_URL ?? '(not set)',
    musicPath: process.env.MUSIC_PATH ?? '(not set)',
  })
})

// serve compiled frontend in production
const frontendDist = path.join(__dirname, '../../frontend/dist')
app.use(express.static(frontendDist))
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'))
})

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('unhandled error:', err)
  res.status(500).json({ error: err.message })
})

app.listen(PORT, () => {
  console.log(`beetjuice listening on http://localhost:${PORT}`)
  console.log(`beets api → ${process.env.BEETS_API_URL ?? 'http://localhost:8337 (fallback — check .env)'}`)
})
