import 'dotenv/config'
import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import albumRoutes from './routes/albums.js'
import itemRoutes from './routes/items.js'
import duplicateRoutes from './routes/duplicates.js'
import statsRoutes from './routes/stats.js'
import healthRoutes from './routes/health.js'
import playlistRoutes from './routes/playlists.js'
import { logger } from './lib/logger.js'

const app = express()
const PORT = process.env.PORT ?? 3001
const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.use(cors())
app.use(express.json())

// Request logger — one line per request with method, path, status, duration
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now()
  res.on('finish', () => {
    const ms = Date.now() - start
    const msg = `${req.method} ${req.path} ${res.statusCode} ${ms}ms`
    if (res.statusCode >= 500) logger.error(msg)
    else if (res.statusCode >= 400) logger.warn(msg)
    else logger.info(msg)
  })
  next()
})

app.use('/api/albums', albumRoutes)
app.use('/api/items', itemRoutes)
app.use('/api/duplicates', duplicateRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/health', healthRoutes)
app.use('/api/playlists', playlistRoutes)

app.get('/api/config', (_req, res) => {
  res.json({
    beetsApiUrl: process.env.BEETS_API_URL ?? '(not set)',
    musicPath: process.env.MUSIC_PATH ?? '(not set)',
    beetsLibraryPath: process.env.BEETS_LIBRARY_PATH ?? '(not set — defaults to MUSIC_PATH)',
  })
})

// Serve compiled frontend in production
const frontendDist = path.join(__dirname, '../../frontend/dist')
app.use(express.static(frontendDist))
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'))
})

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(`unhandled error: ${err.message}`)
  res.status(500).json({ error: err.message })
})

app.listen(PORT, () => {
  logger.info('beetjuice started')
  logger.info(`port              ${PORT}`)
  logger.info(`beets api         ${process.env.BEETS_API_URL ?? '(not set — check BEETS_API_URL)'}`)
  logger.info(`music path        ${process.env.MUSIC_PATH ?? '(not set — file deletion disabled)'}`)
  logger.info(`beets lib path    ${process.env.BEETS_LIBRARY_PATH ?? '(not set — defaults to MUSIC_PATH)'}`)
  logger.info(`puid/pgid         ${process.env.PUID ?? 99}/${process.env.PGID ?? 100}`)
})
