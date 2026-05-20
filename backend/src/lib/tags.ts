import { parseFile } from 'music-metadata'

export interface FileTags {
  title: string | null
  artist: string | null
  album: string | null
  mbTrackId: string | null
}

export async function readFileTags(filePath: string): Promise<FileTags | null> {
  try {
    const meta = await parseFile(filePath, { skipCovers: true })
    const c = meta.common
    return {
      title: c.title ?? null,
      artist: c.artist ?? null,
      album: c.album ?? null,
      // music-metadata exposes the MusicBrainz recording ID here (same as beets mb_trackid)
      mbTrackId: c.musicbrainz_recordingid ?? null,
    }
  } catch {
    return null
  }
}

export async function readFileTagsBatch(filePaths: string[]): Promise<(FileTags | null)[]> {
  const CHUNK = 20
  const results: (FileTags | null)[] = []
  for (let i = 0; i < filePaths.length; i += CHUNK) {
    const chunk = await Promise.all(filePaths.slice(i, i + CHUNK).map(readFileTags))
    results.push(...chunk)
  }
  return results
}
