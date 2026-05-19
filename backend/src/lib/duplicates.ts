import { distance } from 'fastest-levenshtein'
import type { Album, AlbumSummary, Item, DuplicateGroup } from '../types/beets.js'

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - distance(a, b) / maxLen
}

/** Enrich an Album with track-level summary info */
export function enrichAlbum(album: Album, items: Item[]): AlbumSummary {
  const albumItems = items.filter(i => i.album_id === album.id)
  const formats = [...new Set(albumItems.map(i => i.format))]
  const formatCounts = new Map<string, number>()
  for (const item of albumItems) {
    formatCounts.set(item.format, (formatCounts.get(item.format) ?? 0) + 1)
  }
  // Find the most common format
  let primaryFormat = ''
  let maxCount = 0
  for (const [fmt, count] of formatCounts) {
    if (count > maxCount) {
      maxCount = count
      primaryFormat = fmt
    }
  }

  const totalDuration = albumItems.reduce((sum, i) => sum + (i.length ?? 0), 0)
  const avgBitrate = albumItems.length > 0
    ? albumItems.reduce((sum, i) => sum + (i.bitrate ?? 0), 0) / albumItems.length
    : 0
  const maxSamplerate = albumItems.reduce((max, i) => Math.max(max, i.samplerate ?? 0), 0)
  const maxBitdepth = albumItems.reduce((max, i) => Math.max(max, i.bitdepth ?? 0), 0)
  const totalSize = albumItems.reduce((sum, i) => sum + (i.size ?? 0), 0)

  return {
    ...album,
    trackCount: albumItems.length,
    totalDuration,
    primaryFormat,
    avgBitrate: Math.round(avgBitrate),
    maxSamplerate,
    maxBitdepth,
    formats,
    totalSize,
  }
}

export function findDuplicates(albums: Album[], items: Item[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = []
  const assigned = new Set<number>()

  // Pass 1: exact MusicBrainz album ID
  const byMbId = new Map<string, Album[]>()
  for (const album of albums) {
    if (!album.mb_albumid) continue
    const existing = byMbId.get(album.mb_albumid)
    if (existing) existing.push(album)
    else byMbId.set(album.mb_albumid, [album])
  }
  for (const copies of byMbId.values()) {
    if (copies.length < 2) continue
    copies.forEach(a => assigned.add(a.id))
    groups.push({
      reason: 'mb_albumid',
      copies: copies.map(a => enrichAlbum(a, items)),
    })
  }

  // Pass 2: normalized artist + album name (exact)
  const remaining = albums.filter(a => !assigned.has(a.id))
  const byNorm = new Map<string, Album[]>()
  for (const album of remaining) {
    const key = normalize(`${album.albumartist} ${album.album}`)
    const existing = byNorm.get(key)
    if (existing) existing.push(album)
    else byNorm.set(key, [album])
  }
  for (const copies of byNorm.values()) {
    if (copies.length < 2) continue
    copies.forEach(a => assigned.add(a.id))
    groups.push({
      reason: 'normalized_name',
      copies: copies.map(a => enrichAlbum(a, items)),
    })
  }

  // Pass 3: fuzzy (Levenshtein similarity ≥ 0.85)
  const remaining2 = albums.filter(a => !assigned.has(a.id))
  const used = new Set<number>()
  for (let i = 0; i < remaining2.length; i++) {
    if (used.has(remaining2[i].id)) continue
    const copies: Album[] = [remaining2[i]]
    const keyI = normalize(`${remaining2[i].albumartist} ${remaining2[i].album}`)
    for (let j = i + 1; j < remaining2.length; j++) {
      if (used.has(remaining2[j].id)) continue
      const keyJ = normalize(`${remaining2[j].albumartist} ${remaining2[j].album}`)
      if (similarity(keyI, keyJ) >= 0.85) {
        copies.push(remaining2[j])
        used.add(remaining2[j].id)
      }
    }
    if (copies.length >= 2) {
      used.add(remaining2[i].id)
      groups.push({
        reason: 'fuzzy',
        copies: copies.map(a => enrichAlbum(a, items)),
      })
    }
  }

  return groups
}
