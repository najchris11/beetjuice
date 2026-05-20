export interface ParsedEntry {
  title: string | null
  artist: string | null
  album: string | null
  duration: number | null
  originalPath: string
  mbTrackId: string | null
}

export type MatchStatus = 'matched' | 'low_confidence' | 'unmatched'

export interface MatchedItem {
  id: number
  title: string
  artist: string
  album: string
  path: string
}

export interface MatchResult {
  entry: ParsedEntry
  status: MatchStatus
  confidence: number
  item: MatchedItem | null
  sourcePath: string | null
}

export interface TrackSelection {
  title: string
  artist: string
  duration: number | null
  itemPath: string | null
  sourcePath: string | null
}

export interface NavidromeConfig {
  url?: string
  token?: string
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
