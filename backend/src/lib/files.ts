import fs from 'node:fs/promises'
import path from 'node:path'

export function musicPath(): string | undefined {
  return process.env.MUSIC_PATH || undefined
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

/** Read artwork from artpath. Returns buffer + detected content-type, or null if unavailable. */
export async function readArtwork(artpath: string): Promise<{ data: Buffer; contentType: string } | null> {
  if (!artpath) return null
  try {
    const data = await fs.readFile(artpath)
    const ext = path.extname(artpath).toLowerCase()
    const contentType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg'
    return { data, contentType }
  } catch {
    return null
  }
}

function isNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT'
}
