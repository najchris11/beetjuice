import { Router } from 'express'
import fs from 'node:fs/promises'
import { musicPath, libraryPath, resolvePath } from '../lib/files.js'

interface BeetsItem { path?: string }
interface BeetsItemList { items: BeetsItem[] }

interface CheckResult {
  ok: boolean
  label: string
  detail: string
  fix?: string[]
}

const router = Router()

router.get('/', async (_req, res) => {
  const checks: Record<string, CheckResult> = {}
  const beetsUrl = process.env.BEETS_API_URL ?? '(not set)'
  const puid = process.env.PUID ?? '99'
  const pgid = process.env.PGID ?? '100'

  // 1. Beets API reachable
  try {
    const r = await fetch(`${beetsUrl}/stats`)
    if (r.ok) {
      checks.beetsApi = { ok: true, label: 'Beets API', detail: `Connected to ${beetsUrl}` }
    } else {
      checks.beetsApi = {
        ok: false,
        label: 'Beets API',
        detail: `${beetsUrl} returned HTTP ${r.status}`,
        fix: [
          `Verify BEETS_API_URL is correct (current: ${beetsUrl})`,
          'Check that the beets web plugin is running and configured:\n  web:\n    host: 0.0.0.0\n    port: 8337\n    readonly: no',
          'If using Docker networking, confirm beetjuice and beets share the same Docker network',
        ],
      }
    }
  } catch (err) {
    checks.beetsApi = {
      ok: false,
      label: 'Beets API',
      detail: `Cannot reach ${beetsUrl}`,
      fix: [
        `Verify BEETS_API_URL is correct (current: ${beetsUrl})`,
        'Check that the beets web plugin is running and configured:\n  web:\n    host: 0.0.0.0\n    port: 8337\n    readonly: no',
        'If using Docker networking, confirm beetjuice and beets share the same Docker network',
      ],
    }
  }

  // 2. Beets write mode — DELETE on item/0: 404 = writes allowed, 405 = readonly
  if (checks.beetsApi.ok) {
    try {
      const r = await fetch(`${beetsUrl}/item/0`, { method: 'DELETE' })
      if (r.status === 405) {
        checks.beetsWritable = {
          ok: false,
          label: 'Beets write mode',
          detail: 'Beets web plugin is in readonly mode — deletion will fail',
          fix: [
            'Edit your beets config.yaml and set readonly: no under the web section:',
            'web:\n  host: 0.0.0.0\n  port: 8337\n  readonly: no',
            'Restart the beets container after saving the config',
          ],
        }
      } else {
        checks.beetsWritable = {
          ok: true,
          label: 'Beets write mode',
          detail: 'Beets API accepts write operations',
        }
      }
    } catch {
      // network error already caught above; skip this check
    }
  }

  // 3. Music path configured and readable
  const mp = musicPath()
  if (!mp) {
    checks.musicPath = {
      ok: false,
      label: 'Music path',
      detail: 'MUSIC_PATH environment variable is not set',
      fix: [
        'Set MUSIC_PATH to the path where your music library is mounted inside this container',
        'Example: MUSIC_PATH=/music',
        'In Unraid: add a volume mapping for your music share and set MUSIC_PATH to match the container path',
      ],
    }
  } else {
    try {
      await fs.access(mp, fs.constants.R_OK)
      checks.musicPath = { ok: true, label: 'Music path', detail: `${mp} is mounted and readable` }

      // 4. Music path writable (only check if readable)
      try {
        await fs.access(mp, fs.constants.W_OK)
        checks.musicWritable = {
          ok: true,
          label: 'Music path (write)',
          detail: `${mp} is writable — file deletion is enabled`,
        }
      } catch {
        checks.musicWritable = {
          ok: false,
          label: 'Music path (write)',
          detail: `${mp} is mounted read-only — file deletion will not work`,
          fix: [
            'In Unraid: open beetjuice container settings and change the music volume mount mode to Read/Write',
            `Confirm PUID/PGID (${puid}/${pgid}) have write permission on the music share`,
          ],
        }
      }
    } catch {
      checks.musicPath = {
        ok: false,
        label: 'Music path',
        detail: `Cannot access ${mp} — volume may not be mounted`,
        fix: [
          `Add a volume mapping for your music library to ${mp} in the container settings`,
          `In Unraid: Add Path → Host Path: /mnt/user/music → Container Path: ${mp} → Access Mode: Read/Write`,
          `Confirm PUID/PGID (${puid}/${pgid}) have read access to the share`,
        ],
      }
    }
  }

  // 5. Beets path alignment — resolve a sample item path and confirm the file exists on disk
  if (checks.beetsApi?.ok && mp && checks.musicPath?.ok) {
    try {
      const data: BeetsItemList = await fetch(`${beetsUrl}/item/`).then(r => r.json())
      const sample = data.items?.find(i => i.path)
      if (!sample?.path) {
        checks.beetsPathsConfig = {
          ok: false,
          label: 'Beets item paths',
          detail: 'Beets items have no path field — beetjuice cannot locate files for deletion',
          fix: [
            'Ensure the beets web plugin is not stripping the path field',
            'Check that your beets library has been imported with file paths stored',
          ],
        }
      } else {
        const lib = libraryPath()
        const resolved = resolvePath(sample.path)
        const isRelative = !sample.path.startsWith('/')
        const outsideMusicPath = !resolved.startsWith(mp)

        if (outsideMusicPath) {
          checks.beetsPathsConfig = {
            ok: false,
            label: 'Beets item paths',
            detail: isRelative
              ? `Beets returns relative paths (e.g. "${sample.path}") — BEETS_LIBRARY_PATH must be set to the library root`
              : `Resolved path "${resolved}" is outside MUSIC_PATH "${mp}"`,
            fix: isRelative ? [
              `Set BEETS_LIBRARY_PATH to your beets library root inside this container`,
              `Example: if your music is mounted at /music and beets uses the "clean" subfolder, set BEETS_LIBRARY_PATH=/music/clean`,
              `Current MUSIC_PATH: "${mp}", current BEETS_LIBRARY_PATH: "${lib || '(not set)'}"`,
              `Sample beets path: "${sample.path}" → should resolve to ${mp}/.../${sample.path}`,
            ] : [
              `Beets paths start with a different prefix than MUSIC_PATH`,
              `MUSIC_PATH: "${mp}", resolved path: "${resolved}"`,
              `Update MUSIC_PATH to match the mount point of your beets library`,
            ],
          }
        } else {
          // Resolved path is within MUSIC_PATH — now confirm the file actually exists
          try {
            await fs.access(resolved, fs.constants.F_OK)
            checks.beetsPathsConfig = {
              ok: true,
              label: 'Beets item paths',
              detail: `Paths resolve correctly and files are reachable on disk${isRelative ? ` (relative via BEETS_LIBRARY_PATH="${lib}")` : ''}`,
            }
          } catch {
            checks.beetsPathsConfig = {
              ok: false,
              label: 'Beets item paths',
              detail: `Resolved path "${resolved}" is within MUSIC_PATH but file not found on disk`,
              fix: [
                `The resolved path looks right but the file doesn't exist — check that your music volume is mounted correctly`,
                `Beets path: "${sample.path}" → resolved: "${resolved}"`,
                `Confirm the same share is mounted in both containers at the same path`,
              ],
            }
          }
        }
      }
    } catch {
      // non-fatal, skip
    }
  }

  res.json({ ok: Object.values(checks).every(c => c.ok), checks })
})

export default router
