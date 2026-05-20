import { distance } from 'fastest-levenshtein'
import type { Item } from '../types/beets.js'
import type { ParsedEntry, MatchResult, MatchedItem } from '../types/playlists.js'
import { resolvePath } from './files.js'

const MATCHED_THRESHOLD = 0.75
const LOW_CONFIDENCE_THRESHOLD = 0.5

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
      return makeResult(entry, exact, 1.0, 'matched')
    }
  }

  if (!entry.title && !entry.artist) {
    return { entry, status: 'unmatched', confidence: 0, item: null, sourcePath: resolveSourcePath(entry) }
  }

  const normEntryTitle = normalizeString(entry.title ?? '')
  const normEntryArtist = normalizeString(entry.artist ?? '')
  const normEntryAlbum = normalizeString(entry.album ?? '')

  let best: { item: Item; confidence: number } | null = null

  for (const n of normalized) {
    const titleSim = normEntryTitle ? similarity(normEntryTitle, n.normTitle) : 0
    const artistSim = normEntryArtist ? similarity(normEntryArtist, n.normArtist) : 0

    let confidence = titleSim * 0.50 + artistSim * 0.35

    if (normEntryAlbum && n.normAlbum) {
      confidence += similarity(normEntryAlbum, n.normAlbum) * 0.15
    }

    // Cap fuzzy confidence below the matched threshold
    confidence = Math.min(0.85, Math.max(0, confidence))

    if (!best || confidence > best.confidence) {
      best = { item: n.item, confidence }
    }
  }

  if (!best || best.confidence < LOW_CONFIDENCE_THRESHOLD) {
    return { entry, status: 'unmatched', confidence: 0, item: null, sourcePath: resolveSourcePath(entry) }
  }

  const status = best.confidence >= MATCHED_THRESHOLD ? 'matched' : 'low_confidence'
  return makeResult(entry, best.item, best.confidence, status)
}

function makeResult(entry: ParsedEntry, item: Item, confidence: number, status: MatchResult['status']): MatchResult {
  const matched: MatchedItem = {
    id: item.id,
    title: item.title,
    artist: item.artist,
    album: item.album,
    path: resolvePath(item.path),
  }
  return { entry, status, confidence, item: matched, sourcePath: null }
}

function resolveSourcePath(entry: ParsedEntry): string | null {
  const p = entry.originalPath
  if (!p || !p.startsWith('/')) return null
  return p
}
