export interface Album {
  id: number
  album: string
  albumartist: string
  year: number
  genre: string
  mb_albumid: string
  artpath: string
  path: string
  label?: string
  albumtype?: string
  media?: string
  disctotal?: number
}

export interface Item {
  id: number
  title: string
  artist: string
  albumartist: string
  album: string
  album_id: number
  track: number
  disc: number
  year: number
  genre: string
  format: string
  bitrate: number
  samplerate: number
  bitdepth: number
  length: number
  size: number
  path: string
  mb_trackid: string
  mb_albumid: string
}

export interface AlbumSummary extends Album {
  trackCount: number
  totalDuration: number
  primaryFormat: string
  avgBitrate: number
  maxSamplerate: number
  maxBitdepth: number
  formats: string[]
  totalSize: number
}

export interface DuplicateGroup {
  reason: 'mb_albumid' | 'normalized_name' | 'fuzzy'
  copies: AlbumSummary[]
}

export interface Stats {
  items: number
  albums: number
}
