import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useDuplicates, useDeleteAlbum } from '../hooks/useBeets.ts'
import ConfirmDialog from '../components/ConfirmDialog.tsx'
import FormatBadge, { isLossless } from '../components/FormatBadge.tsx'
import { addToast } from '../hooks/useToast.ts'
import { formatBitrate, formatDuration, formatSamplerate } from '../utils/format.ts'
import type { AlbumSummary, DuplicateGroup } from '../types/beets.ts'

const reasonConfig: Record<string, { label: string; color: string; icon: string }> = {
  mb_albumid: {
    label: 'Same MusicBrainz release',
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    icon: '🔗',
  },
  normalized_name: {
    label: 'Matching name',
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    icon: '📝',
  },
  fuzzy: {
    label: 'Similar name',
    color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    icon: '🔍',
  },
}

type FilterReason = 'all' | 'mb_albumid' | 'normalized_name' | 'fuzzy'

/** Determine which copy has the "best" quality for a given metric */
function findBest<T>(copies: AlbumSummary[], getValue: (a: AlbumSummary) => T, compare: (a: T, b: T) => number): Set<number> {
  if (copies.length === 0) return new Set()
  let bestVal = getValue(copies[0])
  let bestIds = new Set([copies[0].id])
  for (let i = 1; i < copies.length; i++) {
    const val = getValue(copies[i])
    const cmp = compare(val, bestVal)
    if (cmp > 0) {
      bestVal = val
      bestIds = new Set([copies[i].id])
    } else if (cmp === 0) {
      bestIds.add(copies[i].id)
    }
  }
  // Only highlight if there's actually a difference
  if (bestIds.size === copies.length) return new Set()
  return bestIds
}

function DiffRow({ label, values, highlightIds, className = '' }: {
  label: string
  values: { id: number; content: React.ReactNode }[]
  highlightIds?: Set<number>
  className?: string
}) {
  const allSame = values.length > 1 && values.every(v => {
    const first = typeof values[0].content === 'string' ? values[0].content : null
    const curr = typeof v.content === 'string' ? v.content : null
    return first !== null && curr !== null && first === curr
  })

  return (
    <div className={`grid gap-3 ${className}`} style={{ gridTemplateColumns: `120px repeat(${values.length}, 1fr)` }}>
      <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider flex items-center font-medium">
        {label}
      </div>
      {values.map(v => {
        const isBest = highlightIds?.has(v.id) ?? false
        const isDifferent = !allSame && values.length > 1
        return (
          <div
            key={v.id}
            className={`text-sm px-2 py-1 rounded-md transition-colors ${
              isBest
                ? 'bg-emerald-500/10 text-emerald-300 font-medium'
                : isDifferent
                  ? 'text-[var(--text-secondary)]'
                  : 'text-[var(--text-muted)]'
            }`}
          >
            {v.content}
          </div>
        )
      })}
    </div>
  )
}

function AlbumArtSmall({ albumId, name }: { albumId: number; name: string }) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const hue1 = hash % 360
  const hue2 = (hue1 + 40) % 360

  return (
    <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-[var(--bg-secondary)]">
      <img
        src={`/api/albums/${albumId}/art`}
        alt={name}
        className="w-full h-full object-cover"
        onError={e => {
          const img = e.currentTarget as HTMLImageElement
          img.style.display = 'none'
          const fallback = img.nextElementSibling as HTMLElement
          if (fallback) fallback.style.display = 'flex'
        }}
      />
      <div
        className="w-full h-full hidden items-center justify-center"
        style={{
          background: `linear-gradient(135deg, hsl(${hue1}, 30%, 18%), hsl(${hue2}, 25%, 12%))`,
        }}
      >
        <svg className="w-6 h-6 text-white/20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
      </div>
    </div>
  )
}

function DuplicateGroupCard({
  group,
  onDelete,
  onDismiss,
  isDismissed,
}: {
  group: DuplicateGroup
  onDelete: (album: AlbumSummary) => void
  onDismiss: (group: DuplicateGroup) => void
  isDismissed: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = reasonConfig[group.reason] ?? reasonConfig.fuzzy
  const copies = group.copies

  // Determine "best" for each metric
  const bestFormat = findBest(copies, a => (a.formats.some(f => isLossless(f)) ? 1 : 0), (a, b) => a - b)
  const bestBitrate = findBest(copies, a => a.avgBitrate, (a, b) => a - b)
  const bestSamplerate = findBest(copies, a => a.maxSamplerate, (a, b) => a - b)
  const bestBitdepth = findBest(copies, a => a.maxBitdepth, (a, b) => a - b)
  const bestTracks = findBest(copies, a => a.trackCount, (a, b) => a - b)

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-card)] fade-in">
      {/* Group header */}
      <div className="px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${cfg.color}`}>
            {cfg.icon} {cfg.label}
          </span>
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {copies[0]?.albumartist} — {copies[0]?.album}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {copies.length} copies
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isDismissed && (
            <button
              onClick={() => onDismiss(group)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              title="Mark as not a duplicate"
            >
              Not a duplicate
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors flex items-center gap-1"
          >
            {expanded ? 'Collapse' : 'Compare'}
            <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Quick summary — always visible */}
      <div className="grid divide-x divide-[var(--border-subtle)]" style={{ gridTemplateColumns: `repeat(${copies.length}, 1fr)` }}>
        {copies.map(album => (
          <div key={album.id} className="p-4 flex gap-3 group/copy">
            <AlbumArtSmall albumId={album.id} name={album.album} />
            <div className="min-w-0 flex-1 space-y-1">
              <Link
                to={`/album/${album.id}`}
                className="text-sm font-medium text-[var(--text-primary)] hover:text-purple-300 truncate block transition-colors"
              >
                {album.album}
              </Link>
              <div className="flex items-center gap-2 flex-wrap">
                {album.formats.map(f => (
                  <FormatBadge key={f} format={f} size="xs" />
                ))}
                <span className="text-xs text-[var(--text-muted)] tabular-nums">
                  {album.trackCount} tracks · {formatDuration(album.totalDuration)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                <span className="tabular-nums font-mono">{formatBitrate(album.avgBitrate)}</span>
                {album.maxSamplerate > 0 && (
                  <span className="tabular-nums font-mono">{formatSamplerate(album.maxSamplerate)}</span>
                )}
                {album.maxBitdepth > 0 && (
                  <span className="tabular-nums font-mono">{album.maxBitdepth}bit</span>
                )}
              </div>
              <button
                onClick={() => onDelete(album)}
                className="mt-1 text-xs text-red-500/70 hover:text-red-400 transition-colors"
              >
                Delete this copy
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Expanded comparison */}
      {expanded && (
        <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 p-4 space-y-1.5">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Detailed Comparison
          </p>

          <DiffRow
            label="Format"
            values={copies.map(a => ({
              id: a.id,
              content: (
                <div className="flex gap-1.5 flex-wrap">
                  {a.formats.map(f => <FormatBadge key={f} format={f} size="xs" />)}
                </div>
              ),
            }))}
            highlightIds={bestFormat}
          />

          <DiffRow
            label="Avg Bitrate"
            values={copies.map(a => ({ id: a.id, content: formatBitrate(a.avgBitrate) }))}
            highlightIds={bestBitrate}
          />

          <DiffRow
            label="Sample Rate"
            values={copies.map(a => ({
              id: a.id,
              content: a.maxSamplerate > 0 ? formatSamplerate(a.maxSamplerate) : '—',
            }))}
            highlightIds={bestSamplerate}
          />

          <DiffRow
            label="Bit Depth"
            values={copies.map(a => ({
              id: a.id,
              content: a.maxBitdepth > 0 ? `${a.maxBitdepth}bit` : '—',
            }))}
            highlightIds={bestBitdepth}
          />

          <DiffRow
            label="Tracks"
            values={copies.map(a => ({ id: a.id, content: `${a.trackCount}` }))}
            highlightIds={bestTracks}
          />

          <DiffRow
            label="Duration"
            values={copies.map(a => ({ id: a.id, content: formatDuration(a.totalDuration) }))}
          />

          <DiffRow
            label="Year"
            values={copies.map(a => ({ id: a.id, content: a.year > 0 ? `${a.year}` : '—' }))}
          />
        </div>
      )}
    </div>
  )
}

const DISMISSED_KEY = 'beetjuice:dismissed-dupes'

function groupId(group: DuplicateGroup): string {
  return `${group.reason}:${group.copies.map(c => c.id).sort().join(',')}`
}

function loadDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

function saveDismissed(ids: Set<string>): void {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]))
}

export default function Duplicates() {
  const { data: groups, isLoading, error } = useDuplicates()
  const deleteAlbum = useDeleteAlbum()
  const [confirm, setConfirm] = useState<AlbumSummary | null>(null)
  const [filter, setFilter] = useState<FilterReason>('all')
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed)
  const [showDismissed, setShowDismissed] = useState(false)

  const dismissGroup = (group: DuplicateGroup) => {
    const next = new Set(dismissed)
    next.add(groupId(group))
    saveDismissed(next)
    setDismissed(next)
  }

  const restoreAll = () => {
    saveDismissed(new Set())
    setDismissed(new Set())
    setShowDismissed(false)
  }

  const visibleGroups = useMemo(() => {
    if (!groups) return []
    return groups.filter(g => showDismissed || !dismissed.has(groupId(g)))
  }, [groups, dismissed, showDismissed])

  const filtered = useMemo(() => {
    if (filter === 'all') return visibleGroups
    return visibleGroups.filter(g => g.reason === filter)
  }, [visibleGroups, filter])

  const counts = useMemo(() => {
    if (!visibleGroups) return { all: 0, mb_albumid: 0, normalized_name: 0, fuzzy: 0 }
    return {
      all: visibleGroups.length,
      mb_albumid: visibleGroups.filter(g => g.reason === 'mb_albumid').length,
      normalized_name: visibleGroups.filter(g => g.reason === 'normalized_name').length,
      fuzzy: visibleGroups.filter(g => g.reason === 'fuzzy').length,
    }
  }, [visibleGroups])

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="h-12 mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl skeleton h-32" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="rounded-xl bg-[var(--danger-subtle)] border border-red-500/20 p-6 text-red-300 text-sm">
          <p className="font-medium mb-1">Failed to load duplicates</p>
          <p className="text-red-400/80 text-xs">{String(error)}</p>
        </div>
      </div>
    )
  }

  if (!groups?.length) {
    return (
      <div className="max-w-6xl mx-auto text-center py-24">
        <svg className="w-16 h-16 mx-auto mb-4 text-emerald-500/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <p className="text-lg text-[var(--text-secondary)] font-medium">No duplicates found</p>
        <p className="text-sm text-[var(--text-muted)] mt-1">Your library is clean!</p>
      </div>
    )
  }

  const filterOptions: { key: FilterReason; label: string }[] = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'mb_albumid', label: `MusicBrainz (${counts.mb_albumid})` },
    { key: 'normalized_name', label: `Name match (${counts.normalized_name})` },
    { key: 'fuzzy', label: `Fuzzy (${counts.fuzzy})` },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Duplicate Albums</h1>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <p className="text-sm text-[var(--text-muted)]">
              {counts.all} group{counts.all !== 1 ? 's' : ''} — review each and delete the copy you don't need.
            </p>
            {dismissed.size > 0 && (
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <span>{dismissed.size} dismissed</span>
                <button
                  onClick={() => setShowDismissed(s => !s)}
                  className="text-purple-400 hover:text-purple-300 transition-colors"
                >
                  {showDismissed ? 'Hide' : 'Show'}
                </button>
                <button onClick={restoreAll} className="text-[var(--text-muted)] hover:text-red-400 transition-colors">
                  Reset
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          {filterOptions.map(opt => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === opt.key
                  ? 'bg-[var(--accent-subtle)] text-purple-300'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-4">
        {filtered.map((group) => (
          <DuplicateGroupCard
            key={`${group.reason}-${group.copies.map(c => c.id).join('-')}`}
            group={group}
            onDelete={album => setConfirm(album)}
            onDismiss={dismissGroup}
            isDismissed={dismissed.has(groupId(group))}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-[var(--text-muted)]">No duplicates match this filter.</p>
        </div>
      )}

      {/* Delete confirm */}
      {confirm && (
        <ConfirmDialog
          title="Delete album"
          description={`Permanently delete "${confirm.album}" by ${confirm.albumartist} and all its files?\n\nFormat: ${confirm.formats.join(', ')} · ${confirm.trackCount} tracks · ${formatBitrate(confirm.avgBitrate)}\n\nThis cannot be undone.`}
          onConfirm={() => {
            const albumName = confirm.album
            const artistName = confirm.albumartist
            deleteAlbum.mutate(confirm.id, {
              onSuccess: (result) => {
                const detail = result.filesDeleted
                  ? `"${albumName}" by ${artistName} removed from library and disk.`
                  : `"${albumName}" by ${artistName} removed from library (no files found on disk).`
                addToast('success', 'Album deleted', detail)
                setConfirm(null)
              },
              onError: (err) => {
                addToast('error', 'Delete failed', String(err))
                setConfirm(null)
              },
            })
          }}
          onCancel={() => setConfirm(null)}
          loading={deleteAlbum.isPending}
        />
      )}
    </div>
  )
}
