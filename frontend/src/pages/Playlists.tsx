import { useState, useRef } from 'react'
import { useImportPlaylist, useExportPlaylist } from '../hooks/useBeets.ts'
import type { MatchResult, NavidromeConfig, TrackSelection } from '../types/playlists.ts'

const ND_STORAGE_KEY = 'beetjuice:navidrome-config'

function loadNdConfig(): NavidromeConfig {
  try {
    const raw = localStorage.getItem(ND_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

interface RowState {
  result: MatchResult
  included: boolean
}

function statusColor(result: MatchResult) {
  if (result.status === 'matched') return 'text-green-400'
  if (result.status === 'low_confidence') return 'text-amber-400'
  return result.sourcePath ? 'text-orange-400' : 'text-red-400'
}

function statusBadge(result: MatchResult) {
  if (result.status === 'matched') return 'Matched'
  if (result.status === 'low_confidence') return 'Review'
  return result.sourcePath ? 'Copy to staging' : 'Not found'
}

function StatusDot({ result }: { result: MatchResult }) {
  const color =
    result.status === 'matched' ? 'bg-green-500' :
    result.status === 'low_confidence' ? 'bg-amber-500' :
    result.sourcePath ? 'bg-orange-500' : 'bg-red-500'
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 mt-1 ${color}`} />
}

export default function Playlists() {
  const [rows, setRows] = useState<RowState[]>([])
  const [stage, setStage] = useState<'upload' | 'review' | 'done'>('upload')
  const [playlistName, setPlaylistName] = useState('')
  const [exportResult, setExportResult] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const importMutation = useImportPlaylist()
  const exportMutation = useExportPlaylist()
  const ndConfig = loadNdConfig()

  const handleFile = (file: File) => {
    if (!file.name.match(/\.m3u8?$/i)) {
      alert('Please select an .m3u or .m3u8 file')
      return
    }
    const name = file.name.replace(/\.m3u8?$/i, '')
    setPlaylistName(name)
    importMutation.mutate(file, {
      onSuccess: results => {
        setRows(results.map(r => ({
          result: r,
          included: r.status !== 'unmatched' || !!r.sourcePath,
        })))
        setStage('review')
      },
    })
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const toggleRow = (i: number) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, included: !r.included } : r))
  }

  const includedCount = rows.filter(r => r.included).length
  const matchedCount = rows.filter(r => r.result.status === 'matched').length
  const reviewCount = rows.filter(r => r.result.status === 'low_confidence').length
  const unmatchedCount = rows.filter(r => r.result.status === 'unmatched').length

  const handleExport = () => {
    const tracks: TrackSelection[] = rows
      .filter(r => r.included)
      .map(r => ({
        title: r.result.entry.title ?? r.result.item?.title ?? 'Unknown',
        artist: r.result.entry.artist ?? r.result.item?.artist ?? 'Unknown',
        duration: r.result.entry.duration,
        itemPath: r.result.item?.path ?? null,
        sourcePath: r.result.sourcePath,
      }))

    exportMutation.mutate(
      { playlistName, tracks, navidrome: ndConfig },
      {
        onSuccess: result => {
          const parts: string[] = []
          if (result.writtenTo) parts.push(`Written to ${result.writtenTo}`)
          if (result.postedToNavidrome) parts.push('Posted to Navidrome')
          if (result.stagedFiles > 0) parts.push(`${result.stagedFiles} file(s) copied to staging`)
          if (result.skippedFiles > 0) parts.push(`${result.skippedFiles} file(s) skipped`)
          setExportResult(parts.join(' · ') || 'Export complete')
          setStage('done')
        },
      },
    )
  }

  const reset = () => {
    setStage('upload')
    setRows([])
    setPlaylistName('')
    setExportResult(null)
    importMutation.reset()
    exportMutation.reset()
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 fade-in">
      <div>
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1">Playlists</h1>
        <p className="text-[var(--text-muted)] text-sm">Import M3U playlists and export them with your clean library paths</p>
      </div>

      {stage === 'upload' && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
          <div className="px-6 py-4 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Import M3U</h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">Supports .m3u and .m3u8 files with EXTINF metadata</p>
          </div>
          <div className="p-8">
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-purple-500/60 bg-purple-500/10'
                  : 'border-[var(--border-subtle)] hover:border-purple-500/40 hover:bg-white/[0.02]'
              }`}
            >
              <svg className="w-10 h-10 mx-auto mb-4 text-[var(--text-muted)]/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 19V6l12-3v13" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              <p className="text-sm text-[var(--text-muted)] font-medium">
                {importMutation.isPending ? 'Matching tracks…' : 'Drop .m3u file here or click to browse'}
              </p>
              {importMutation.isPending && (
                <div className="mt-3 flex justify-center">
                  <svg className="w-5 h-5 animate-spin text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
                  </svg>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".m3u,.m3u8"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            {importMutation.error && (
              <p className="mt-3 text-xs text-red-400">{String(importMutation.error)}</p>
            )}
          </div>
        </div>
      )}

      {stage === 'review' && (
        <>
          {/* Summary bar */}
          <div className="flex items-center gap-6 px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs">
            <span className="flex items-center gap-1.5 text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-500" /> {matchedCount} matched
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> {reviewCount} to review
            </span>
            <span className="flex items-center gap-1.5 text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-500" /> {unmatchedCount} not found
            </span>
            <span className="ml-auto text-[var(--text-muted)]">{includedCount} of {rows.length} will be exported</span>
          </div>

          {/* Track table */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] w-8"></th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)]">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)]">Source Track</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)]">Matched To</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-muted)] w-20">Conf.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]/50">
                  {rows.map((row, i) => {
                    const canInclude = row.result.status !== 'unmatched' || !!row.result.sourcePath
                    return (
                      <tr
                        key={i}
                        className={`transition-colors ${row.included ? '' : 'opacity-40'} ${canInclude ? 'hover:bg-white/[0.02]' : 'cursor-not-allowed'}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={row.included}
                            disabled={!canInclude}
                            onChange={() => toggleRow(i)}
                            className="rounded accent-purple-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            <StatusDot result={row.result} />
                            <span className={`text-xs font-medium ${statusColor(row.result)}`}>
                              {statusBadge(row.result)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-[var(--text-primary)] leading-tight">
                            {row.result.entry.title ?? '(unknown title)'}
                          </p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            {row.result.entry.artist ?? '(unknown artist)'}
                            {row.result.entry.album ? ` · ${row.result.entry.album}` : ''}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {row.result.item ? (
                            <>
                              <p className="text-[var(--text-secondary)] leading-tight">{row.result.item.title}</p>
                              <p className="text-xs text-[var(--text-muted)] mt-0.5">{row.result.item.artist}</p>
                            </>
                          ) : row.result.sourcePath ? (
                            <p className="text-xs text-[var(--text-muted)] font-mono truncate max-w-xs">
                              {row.result.sourcePath.split('/').slice(-2).join('/')}
                            </p>
                          ) : (
                            <p className="text-xs text-[var(--text-muted)]/50 italic">No match</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {row.result.confidence > 0 ? (
                            <span className={`text-xs ${statusColor(row.result)}`}>
                              {Math.round(row.result.confidence * 100)}%
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--text-muted)]/40">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Export controls */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Export</h2>
            <div>
              <label className="block text-xs text-[var(--text-muted)] font-medium mb-1.5">Playlist Name</label>
              <input
                type="text"
                value={playlistName}
                onChange={e => setPlaylistName(e.target.value)}
                placeholder="My Playlist"
                className="w-full max-w-sm px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            {!ndConfig.url && !ndConfig.playlistsPath && (
              <p className="text-xs text-amber-400/80">
                No Navidrome config found. Configure URL/token or Playlists Path in{' '}
                <a href="/settings" className="underline hover:text-amber-300">Settings</a>.
              </p>
            )}
            {ndConfig.url && (
              <p className="text-xs text-[var(--text-muted)]">API: {ndConfig.url}</p>
            )}
            {ndConfig.playlistsPath && (
              <p className="text-xs text-[var(--text-muted)]">Filesystem: {ndConfig.playlistsPath}</p>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleExport}
                disabled={includedCount === 0 || !playlistName.trim() || exportMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 disabled:opacity-40 disabled:cursor-not-allowed border border-purple-500/20 transition-all"
              >
                {exportMutation.isPending ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
                    </svg>
                    Exporting…
                  </>
                ) : (
                  `Export ${includedCount} track${includedCount !== 1 ? 's' : ''}`
                )}
              </button>
              <button onClick={reset} className="px-4 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
                Start over
              </button>
              {exportMutation.error && (
                <span className="text-xs text-red-400">{String(exportMutation.error)}</span>
              )}
            </div>
          </div>
        </>
      )}

      {stage === 'done' && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-8 text-center space-y-4">
          <div className="flex justify-center">
            <svg className="w-12 h-12 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-green-300">Playlist exported</p>
          {exportResult && <p className="text-sm text-green-400/80">{exportResult}</p>}
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-white/[0.04] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.08] transition-all border border-[var(--border-subtle)]"
          >
            Import another
          </button>
        </div>
      )}
    </div>
  )
}
