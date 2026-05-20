import type { ParsedEntry } from '../types/playlists.js'

export function parseM3u(content: string): ParsedEntry[] {
  const lines = content.split(/\r?\n/)
  const entries: ParsedEntry[] = []
  let pendingTitle: string | null = null
  let pendingArtist: string | null = null
  let pendingAlbum: string | null = null
  let pendingDuration: number | null = null
  let pendingMbTrackId: string | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed === '#EXTM3U') continue

    if (trimmed.startsWith('#EXTINF:')) {
      const parsed = parseExtinf(trimmed)
      pendingDuration = parsed.duration
      pendingTitle = parsed.title
      pendingArtist = parsed.artist
      pendingAlbum = parsed.album
      pendingMbTrackId = parsed.mbTrackId
      continue
    }

    if (trimmed.startsWith('#')) continue

    entries.push({
      originalPath: trimmed,
      title: pendingTitle,
      artist: pendingArtist,
      album: pendingAlbum,
      duration: pendingDuration,
      mbTrackId: pendingMbTrackId,
      resolvedFilePath: null,
    })

    pendingTitle = null
    pendingArtist = null
    pendingAlbum = null
    pendingDuration = null
    pendingMbTrackId = null
  }

  return entries
}

interface ExtinfFields {
  duration: number | null
  title: string | null
  artist: string | null
  album: string | null
  mbTrackId: string | null
}

function parseExtinf(line: string): ExtinfFields {
  // #EXTINF:duration [key="value" ...],display-title
  const rest = line.slice('#EXTINF:'.length)
  const commaIdx = rest.indexOf(',')
  const metaStr = commaIdx >= 0 ? rest.slice(0, commaIdx) : rest
  const displayTitle = commaIdx >= 0 ? rest.slice(commaIdx + 1).trim() : null

  const durationStr = metaStr.trim().split(/\s+/)[0]
  const rawDuration = parseInt(durationStr, 10)
  const duration = isNaN(rawDuration) ? null : rawDuration

  const attrs = extractAttrs(metaStr)
  const attrArtist = attrs.artist ?? null
  const attrTitle = attrs.title ?? null
  const attrAlbum = attrs.album ?? null
  const mbTrackId = attrs.mbid ?? attrs.musicbrainztrackid ?? null

  // If extended attributes provide artist+title, use them
  if (attrArtist && attrTitle) {
    return { duration, title: attrTitle, artist: attrArtist, album: attrAlbum, mbTrackId }
  }

  // Fall back to parsing "Artist - Title" from the display title
  if (displayTitle) {
    const sep = displayTitle.indexOf(' - ')
    if (sep > 0) {
      return {
        duration,
        artist: displayTitle.slice(0, sep).trim(),
        title: displayTitle.slice(sep + 3).trim(),
        album: attrAlbum,
        mbTrackId,
      }
    }
    return { duration, title: displayTitle, artist: attrArtist, album: attrAlbum, mbTrackId }
  }

  return { duration, title: attrTitle, artist: attrArtist, album: attrAlbum, mbTrackId }
}

function extractAttrs(s: string): Record<string, string> {
  const result: Record<string, string> = {}
  const re = /(\w+)="([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    result[m[1].toLowerCase()] = m[2]
  }
  return result
}

export function buildM3u(tracks: { title: string; artist: string; duration: number | null; relativePath: string }[]): string {
  const lines = ['#EXTM3U']
  for (const t of tracks) {
    const dur = t.duration ?? -1
    lines.push(`#EXTINF:${dur},${t.artist} - ${t.title}`)
    lines.push(t.relativePath)
  }
  lines.push('')
  return lines.join('\n')
}
