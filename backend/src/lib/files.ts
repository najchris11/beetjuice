import fs from 'node:fs/promises'
import path from 'node:path'

/** The mounted music share root — used for the safety boundary check on deletes. */
export function musicPath(): string | undefined {
  return process.env.MUSIC_PATH || undefined
}

/**
 * The beets library root — where beets-relative paths are anchored.
 * Falls back to MUSIC_PATH if not set (covers setups where beets stores absolute paths).
 */
export function libraryPath(): string {
  return process.env.BEETS_LIBRARY_PATH || process.env.MUSIC_PATH || ''
}

/**
 * Resolve a path from the beets API to an absolute filesystem path.
 * Beets can return either absolute paths (/music/clean/Artist/...) or
 * relative paths (Artist/album/track.flac) depending on how the library
 * was configured. If relative, we prepend BEETS_LIBRARY_PATH.
 */
export function resolvePath(beetsPath: string): string {
  if (!beetsPath) return beetsPath
  if (beetsPath.startsWith('/')) return beetsPath
  const lib = libraryPath()
  return lib ? `${lib}/${beetsPath}` : beetsPath
}

/** Delete a single file. Returns true on success, false if file not found, throws on other errors. */
export async function deleteFile(filePath: string): Promise<boolean> {
  try {
    await fs.rm(filePath)
    return true
  } catch (err: unknown) {
    if (isNotFound(err)) return false
    throw err
  }
}

/** Delete a directory and all its contents. Returns true on success, false if not found. */
export async function deleteDir(dirPath: string): Promise<boolean> {
  try {
    await fs.rm(dirPath, { recursive: true })
    return true
  } catch (err: unknown) {
    if (isNotFound(err)) return false
    throw err
  }
}

/** Read artwork from a beets artpath. Returns buffer + detected content-type, or null if unavailable. */
export async function readArtwork(artpath: string): Promise<{ data: Buffer; contentType: string } | null> {
  if (!artpath) return null
  try {
    const resolved = resolvePath(artpath)
    const data = await fs.readFile(resolved)
    const ext = path.extname(resolved).toLowerCase()
    const contentType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg'
    return { data, contentType }
  } catch {
    return null
  }
}

function isNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT'
}
