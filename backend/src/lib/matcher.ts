import { distance } from 'fastest-levenshtein'
import type { Item } from '../types/beets.js'
import type { ParsedEntry, MatchCandidate, MatchResult, MatchedItem } from '../types/playlists.js'
import { resolvePath } from './files.js'

const MATCHED_THRESHOLD = 0.75
const LOW_CONFIDENCE_THRESHOLD = 0.5
const MAX_CANDIDATES = 5

function normalizeString(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function similarity(a: string, b: string): number {
  const na = normalizeString(a)
  const nb = normalizeString(b)
  if (na === nb) return 1.0
  if (!na || !nb) return 0.0
  const maxLen = Math.max(na.length, nb.length)
  return 1.0 - distance(na, nb) / maxLen
}

function isArtistContained(artist: string, otherArtist: string): boolean {
  const na = normalizeString(artist)
  const nb = normalizeString(otherArtist)
  if (na === nb) return true
  if (!na || !nb) return false
  // Check if one is contained in the other as a separate artist
  const artistsB = nb.split(/\s+and\s+|\s*,\s*|&/).map(s => s.trim())
  return artistsB.some(a => a === na)
}

interface NormalizedItem {
  item: Item
  normTitle: string
  normArtist: string
  normAlbum: string
}

export function matchItems(entries: ParsedEntry[], items: Item[]): MatchResult[] {
  const mbIndex = new Map<string, Item>()
  const normalized: NormalizedItem[] = []

  for (const item of items) {
    if (item.mb_trackid) mbIndex.set(item.mb_trackid, item)
    normalized.push({
      item,
      normTitle: normalizeString(item.title ?? ''),
      normArtist: normalizeString(item.artist ?? ''),
      normAlbum: normalizeString(item.album ?? ''),
    })
  }

  return entries.map(entry => matchEntry(entry, normalized, mbIndex))
}

function matchEntry(
  entry: ParsedEntry,
  normalized: NormalizedItem[],
  mbIndex: Map<string, Item>,
): MatchResult {
  // MB track ID exact match
  if (entry.mbTrackId) {
    const exact = mbIndex.get(entry.mbTrackId)
    if (exact) {
      return makeResult(entry, exact, 1.0, 'matched', [])
    }
  }

  if (!entry.title && !entry.artist) {
    return { entry, status: 'unmatched', confidence: 0, item: null, candidates: [], sourcePath: resolveSourcePath(entry) }
  }

  const normEntryTitle = normalizeString(entry.title ?? '')
  const normEntryArtist = normalizeString(entry.artist ?? '')
  const normEntryAlbum = normalizeString(entry.album ?? '')

  const scored: { item: Item; confidence: number }[] = []

  for (const n of normalized) {
    const titleSim = normEntryTitle ? similarity(normEntryTitle, n.normTitle) : 0
    let artistSim = normEntryArtist ? similarity(normEntryArtist, n.normArtist) : 0

    // Boost artist similarity if one is contained in the other (handles collaborations)
    if (normEntryArtist && n.normArtist && artistSim < 0.9) {
      if (isArtistContained(entry.artist ?? '', n.item.artist ?? '')) {
        artistSim = 0.95
      }
    }

    let confidence = titleSim * 0.50 + artistSim * 0.35

    if (normEntryAlbum && n.normAlbum) {
      confidence += similarity(normEntryAlbum, n.normAlbum) * 0.15
    }

    // Cap fuzzy confidence below the matched threshold
    confidence = Math.min(0.85, Math.max(0, confidence))

    scored.push({ item: n.item, confidence })
  }

  scored.sort((a, b) => b.confidence - a.confidence)
  const candidates = scored
    .filter(candidate => candidate.confidence >= LOW_CONFIDENCE_THRESHOLD)
    .slice(0, MAX_CANDIDATES)
    .map(candidate => makeCandidate(candidate.item, candidate.confidence))

  const best = candidates[0]

  if (!best) {
    return { entry, status: 'unmatched', confidence: 0, item: null, candidates: [], sourcePath: resolveSourcePath(entry) }
  }

  const status = best.confidence >= MATCHED_THRESHOLD ? 'matched' : 'low_confidence'
  return makeResult(entry, best, best.confidence, status, candidates)
}

function makeResult(
  entry: ParsedEntry,
  item: Item | MatchCandidate,
  confidence: number,
  status: MatchResult['status'],
  candidates: MatchCandidate[],
): MatchResult {
  const matched = makeCandidate(item, confidence)
  return { entry, status, confidence, item: matched, candidates, sourcePath: null }
}

function makeCandidate(item: Item | MatchCandidate, confidence: number): MatchCandidate {
  return {
    id: item.id,
    title: item.title,
    artist: item.artist,
    album: item.album,
    albumartist: item.albumartist,
    track: item.track,
    disc: item.disc,
    year: item.year,
    format: item.format,
    bitrate: item.bitrate,
    samplerate: item.samplerate,
    bitdepth: item.bitdepth,
    length: item.length,
    path: resolvePath(item.path),
    confidence,
  }
}

function resolveSourcePath(entry: ParsedEntry): string | null {
  if (entry.resolvedFilePath) return entry.resolvedFilePath
  const p = entry.originalPath
  if (!p || !p.startsWith('/')) return null
  return p
}
