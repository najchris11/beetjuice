import { useState, useMemo, useCallback } from 'react'
import { useAlbums, useBulkDeleteAlbums } from '../hooks/useBeets.ts'
import type { AlbumSummary } from '../types/beets.ts'
import AlbumCard from '../components/AlbumCard.tsx'
import ConfirmDialog from '../components/ConfirmDialog.tsx'
import { addToast } from '../hooks/useToast.ts'

type SortKey = 'artist' | 'album' | 'year-desc' | 'year-asc' | 'size-desc' | 'size-asc'

const sortLabels: Record<SortKey, string> = {
  artist: 'Artist',
  album: 'Album',
  'year-desc': 'Year ↓',
  'year-asc': 'Year ↑',
  'size-desc': 'Size ↓',
  'size-asc': 'Size ↑',
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export default function Library() {
  const { data: albums, isLoading, error } = useAlbums()
  const bulkDelete = useBulkDeleteAlbums()

  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('artist')
  const [formatFilter, setFormatFilter] = useState<string | null>(null)
  const [genreFilter, setGenreFilter] = useState<string | null>(null)

  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)

  // Derive available format and genre options from loaded data
  const { formats, genres } = useMemo(() => {
    if (!albums) return { formats: [], genres: [] }
    const fmts = [...new Set(albums.flatMap(a => a.formats))].sort()
    const gnrs = [...new Set(albums.map(a => a.genre).filter(Boolean))].sort()
    return { formats: fmts, genres: gnrs }
  }, [albums])

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
    if (formatFilter) {
      result = result.filter(a => a.formats.includes(formatFilter))
    }
    if (genreFilter) {
      result = result.filter(a => a.genre === genreFilter)
    }
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
  }, [albums, search, sortBy, formatFilter, genreFilter])

  const toggleSelect = useCallback((id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const enterSelectMode = () => {
    setSelectMode(true)
    setSelected(new Set())
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelected(new Set())
  }

  const selectAll = () => {
    setSelected(new Set(filtered.map(a => a.id)))
  }

  const selectedAlbums = useMemo(
    () => (albums ?? []).filter(a => selected.has(a.id)),
    [albums, selected],
  )

  const totalSelectedSize = selectedAlbums.reduce((s, a) => s + a.totalSize, 0)

  const handleBulkDelete = () => {
    const ids = [...selected]
    bulkDelete.mutate(ids, {
      onSuccess: () => {
        addToast('success', `Deleted ${ids.length} album${ids.length !== 1 ? 's' : ''}`, '')
        exitSelectMode()
        setConfirmBulk(false)
      },
      onError: err => {
        addToast('error', 'Bulk delete failed', String(err))
        setConfirmBulk(false)
      },
    })
  }

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
    <div className="max-w-7xl mx-auto space-y-4 fade-in">
      {/* Search & Sort row */}
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

        <div className="flex items-center gap-2 flex-wrap">
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

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-[var(--text-muted)] tabular-nums">
            {filtered.length.toLocaleString()} album{filtered.length !== 1 ? 's' : ''}
          </span>
          {!selectMode ? (
            <button
              onClick={enterSelectMode}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.06] border border-[var(--border-subtle)] transition-all"
            >
              Select
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={selectAll}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.06] transition-all"
              >
                All
              </button>
              <button
                onClick={exitSelectMode}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.06] border border-[var(--border-subtle)] transition-all"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Format + Genre filter chips */}
      {(formats.length > 0 || genres.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap">
          {formats.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-[var(--text-muted)] font-medium shrink-0">Format</span>
              {formats.map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setFormatFilter(f => f === fmt ? null : fmt)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
                    formatFilter === fmt
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                      : 'text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04]'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          )}

          {formats.length > 0 && genres.length > 0 && (
            <div className="w-px h-4 bg-[var(--border-subtle)]" />
          )}

          {genres.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-[var(--text-muted)] font-medium shrink-0">Genre</span>
              {genres.slice(0, 12).map(genre => (
                <button
                  key={genre}
                  onClick={() => setGenreFilter(g => g === genre ? null : genre)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
                    genreFilter === genre
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                      : 'text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04]'
                  }`}
                >
                  {genre}
                </button>
              ))}
              {genres.length > 12 && (
                <span className="text-xs text-[var(--text-muted)]/60">+{genres.length - 12} more</span>
              )}
            </div>
          )}

          {(formatFilter || genreFilter) && (
            <button
              onClick={() => { setFormatFilter(null); setGenreFilter(null) }}
              className="text-xs text-purple-400 hover:text-purple-300 transition-colors ml-1"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

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
              selectMode={selectMode}
              selected={selected.has(album.id)}
              onSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {/* Floating bulk action bar */}
      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-2xl shadow-black/40 backdrop-blur-sm">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {selected.size} album{selected.size !== 1 ? 's' : ''} selected
          </span>
          {totalSelectedSize > 0 && (
            <span className="text-xs text-[var(--text-muted)]">
              · {formatBytes(totalSelectedSize)}
            </span>
          )}
          <div className="w-px h-4 bg-[var(--border-subtle)]" />
          <button
            onClick={() => setConfirmBulk(true)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/15 text-red-400 hover:bg-red-500/25 hover:text-red-300 border border-red-500/20 transition-all"
          >
            Delete {selected.size}
          </button>
        </div>
      )}

      {/* Bulk delete confirmation */}
      {confirmBulk && (
        <ConfirmDialog
          title={`Delete ${selected.size} album${selected.size !== 1 ? 's' : ''}?`}
          description={`Permanently delete ${selected.size} album${selected.size !== 1 ? 's' : ''} and all their files?${totalSelectedSize > 0 ? ` (~${formatBytes(totalSelectedSize)} on disk)` : ''}\n\n${selectedAlbums.slice(0, 5).map(a => `• ${a.albumartist} — ${a.album}`).join('\n')}${selectedAlbums.length > 5 ? `\n• …and ${selectedAlbums.length - 5} more` : ''}\n\nThis cannot be undone.`}
          onConfirm={handleBulkDelete}
          onCancel={() => setConfirmBulk(false)}
          loading={bulkDelete.isPending}
        />
      )}
    </div>
  )
}
