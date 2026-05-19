import { useState, useMemo, useCallback } from 'react'
import { useAlbums } from '../hooks/useBeets.ts'
import type { AlbumSummary } from '../types/beets.ts'
import AlbumCard from '../components/AlbumCard.tsx'

type SortKey = 'artist' | 'album' | 'year-desc' | 'year-asc' | 'size-desc' | 'size-asc'

const sortLabels: Record<SortKey, string> = {
  artist: 'Artist',
  album: 'Album',
  'year-desc': 'Year ↓',
  'year-asc': 'Year ↑',
  'size-desc': 'Size ↓',
  'size-asc': 'Size ↑',
}

export default function Library() {
  const { data: albums, isLoading, error } = useAlbums()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('artist')

  const filtered = useMemo(() => {
    if (!albums) return []
    let result = albums
    const q = search.toLowerCase()
    if (q) {
      result = result.filter(
        a =>
          a.album.toLowerCase().includes(q) ||
          a.albumartist.toLowerCase().includes(q) ||
          String(a.year).includes(q) ||
          a.genre?.toLowerCase().includes(q),
      )
    }
    // Sort
    return [...result].sort((a, b) => {
      switch (sortBy) {
        case 'artist':
          return a.albumartist.localeCompare(b.albumartist) || a.album.localeCompare(b.album)
        case 'album':
          return a.album.localeCompare(b.album)
        case 'year-desc':
          return (b.year || 0) - (a.year || 0) || a.albumartist.localeCompare(b.albumartist)
        case 'year-asc':
          return (a.year || 0) - (b.year || 0) || a.albumartist.localeCompare(b.albumartist)
        case 'size-desc':
          return (b.totalSize || 0) - (a.totalSize || 0) || a.albumartist.localeCompare(b.albumartist)
        case 'size-asc':
          return (a.totalSize || 0) - (b.totalSize || 0) || a.albumartist.localeCompare(b.albumartist)
        default:
          return 0
      }
    })
  }, [albums, search, sortBy])

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="h-12 mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="rounded-xl skeleton aspect-[3/4]" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="rounded-xl bg-[var(--danger-subtle)] border border-red-500/20 p-6 text-red-300 text-sm">
          <p className="font-medium mb-1">Failed to load library</p>
          <p className="text-red-400/80 text-xs">{String(error)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 fade-in">
      {/* Search & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search albums, artists, genres…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] pl-10 pr-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {(Object.keys(sortLabels) as SortKey[]).map(key => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                sortBy === key
                  ? 'bg-[var(--accent-subtle)] text-purple-300'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04]'
              }`}
            >
              {sortLabels[key]}
            </button>
          ))}
        </div>

        <span className="text-xs text-[var(--text-muted)] ml-auto tabular-nums">
          {filtered.length.toLocaleString()} album{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Album Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-24">
          <svg className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)]/50" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
          <p className="text-[var(--text-muted)] text-sm">No albums found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.map((album, i) => (
            <AlbumCard
              key={album.id}
              album={album}
              style={{ animationDelay: `${Math.min(i * 20, 500)}ms` }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
