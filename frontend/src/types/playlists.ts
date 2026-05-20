export interface ParsedEntry {
  title: string | null
  artist: string | null
  album: string | null
  duration: number | null
  originalPath: string
  mbTrackId: string | null
  resolvedFilePath: string | null
}

export type MatchStatus = 'matched' | 'low_confidence' | 'unmatched'

export interface MatchedItem {
  id: number
  title: string
  artist: string
  album: string
  albumartist: string
  track: number
  disc: number
  year: number
  format: string
  bitrate: number
  samplerate: number
  bitdepth: number
  length: number
  path: string
}

export interface MatchCandidate extends MatchedItem {
  confidence: number
}

export interface MatchResult {
  entry: ParsedEntry
  status: MatchStatus
  confidence: number
  item: MatchedItem | null
  candidates: MatchCandidate[]
  sourcePath: string | null
}

export interface TrackSelection {
  title: string
  artist: string
  duration: number | null
  mode: 'library' | 'stage'
  itemPath: string | null
  sourcePath: string | null
}

export interface NavidromeConfig {
  url?: string
  username?: string
  password?: string
  playlistsPath?: string
  stagingFolder?: string
}

export interface ExportRequest {
  playlistName: string
  tracks: TrackSelection[]
  navidrome: NavidromeConfig
}

export interface ExportResult {
  ok: boolean
  writtenTo?: string
  postedToNavidrome: boolean
  stagedFiles: number
  skippedFiles: number
}
