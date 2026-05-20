import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
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
  mode: 'library' | 'stage'
  selectedCandidateId: number | null
}

function getSelectedCandidate(row: RowState) {
  return row.result.candidates.find(candidate => candidate.id === row.selectedCandidateId) ?? row.result.item ?? null
}

function candidateSummary(candidate: { album: string; albumartist: string; track: number; disc: number; year: number; format: string; bitrate: number; samplerate: number; bitdepth: number; length: number }) {
  const bitrate = candidate.bitrate >= 1000 ? `${Math.round(candidate.bitrate / 1000)} kbps` : `${candidate.bitrate} bps`
  const sampleRate = candidate.samplerate >= 1000 ? `${(candidate.samplerate / 1000).toFixed(candidate.samplerate % 1000 === 0 ? 0 : 1)} kHz` : `${candidate.samplerate} Hz`
  const pieces = [
    candidate.albumartist,
    candidate.album,
    `Disc ${candidate.disc} Track ${candidate.track}`,
    candidate.year ? String(candidate.year) : '',
    candidate.format,
    bitrate,
    sampleRate,
    candidate.bitdepth ? `${candidate.bitdepth}-bit` : '',
    candidate.length ? `${Math.round(candidate.length)}s` : '',
  ].filter(Boolean)
  return pieces.join(' · ')
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

function modeBadge(mode: 'library' | 'stage') {
  return mode === 'library' ? 'Library export' : 'Stage to folder'
}

function StatusDot({ result }: { result: MatchResult }) {
  const color =
    result.status === 'matched' ? 'bg-green-500' :
    result.status === 'low_confidence' ? 'bg-amber-500' :
    result.sourcePath ? 'bg-orange-500' : 'bg-red-500'
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 mt-1 ${color}`} />
}

// ─── M3U file picker (portal modal, browses MUSIC_PATH) ─────────────────────

interface M3uPickerProps {
  onSelect: (serverPath: string, name: string) => void
  onClose: () => void
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json() as Promise<T>
}

function M3uPicker({ onSelect, onClose }: M3uPickerProps) {
  const [browsePath, setBrowsePath] = useState('')

  const { data, isLoading } = useQuery<{ dirs: string[]; files: string[]; current: string }>({
    queryKey: ['m3u-dirs', browsePath],
    queryFn: () => apiFetch(`/api/playlists/dirs?path=${encodeURIComponent(browsePath)}&root=music&files=m3u`),
  })

  const segments = browsePath ? browsePath.split('/').filter(Boolean) : []
  const dirs = data?.dirs ?? []
  const files = data?.files ?? []

  const navigate = (sub: string) => setBrowsePath(sub)
  const goSegment = (idx: number) => setBrowsePath(segments.slice(0, idx + 1).join('/'))

  const selectFile = (filename: string) => {
    const fullPath = browsePath ? `${browsePath}/${filename}` : filename
    onSelect(fullPath, filename.replace(/\.m3u8?$/i, ''))
  }

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-2xl flex flex-col"
        style={{ maxHeight: '70vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Browse for M3U file</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">MUSIC_PATH</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="shrink-0 px-5 py-2.5 border-b border-[var(--border-subtle)] flex items-center gap-1 text-xs overflow-x-auto">
          <button
            onClick={() => navigate('')}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
          >
            root
          </button>
          {segments.map((seg, idx) => (
            <span key={idx} className="flex items-center gap-1 shrink-0">
              <span className="text-[var(--text-muted)]/40">›</span>
              <button
                onClick={() => goSegment(idx)}
                className={idx === segments.length - 1
                  ? 'font-semibold text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors'}
              >
                {seg}
              </button>
            </span>
          ))}
        </div>

        {/* Directory + file list */}
        <div className="flex-1 overflow-y-auto min-h-0 py-1">
          {isLoading && (
            <p className="px-5 py-4 text-xs text-[var(--text-muted)]">Loading…</p>
          )}
          {!isLoading && dirs.length === 0 && files.length === 0 && (
            <p className="px-5 py-4 text-xs text-[var(--text-muted)]/60 italic">Empty directory</p>
          )}
          {dirs.map(dir => {
            const sub = browsePath ? `${browsePath}/${dir}` : dir
            return (
              <button
                key={dir}
                onClick={() => navigate(sub)}
                className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-white/[0.04] transition-colors text-left"
              >
                <svg className="w-4 h-4 shrink-0 text-[var(--text-muted)]/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-sm font-mono text-[var(--text-secondary)] truncate">{dir}</span>
                <svg className="w-3.5 h-3.5 shrink-0 ml-auto text-[var(--text-muted)]/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )
          })}
          {files.map(file => (
            <button
              key={file}
              onClick={() => selectFile(file)}
              className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-purple-500/10 transition-colors text-left group"
            >
              <svg className="w-4 h-4 shrink-0 text-purple-400/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 19V6l12-3v13" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              <span className="text-sm font-mono text-purple-300 truncate">{file}</span>
              <span className="ml-auto text-xs text-purple-400/60 group-hover:text-purple-400 transition-colors shrink-0">Select</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function Playlists() {
  const [rows, setRows] = useState<RowState[]>([])
  const [stage, setStage] = useState<'upload' | 'review' | 'done'>('upload')
  const [playlistName, setPlaylistName] = useState('')
  const [exportResult, setExportResult] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [importMode, setImportMode] = useState<'server' | 'local'>('server')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedServerPath, setSelectedServerPath] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const importMutation = useImportPlaylist()
  const exportMutation = useExportPlaylist()
  const ndConfig = loadNdConfig()

  const makeRowState = (result: MatchResult): RowState => {
    const hasSource = !!result.sourcePath
    const selectedCandidateId = result.item?.id ?? result.candidates[0]?.id ?? null
    return {
      result,
      included: result.status !== 'unmatched' || hasSource,
      mode: result.status === 'unmatched' && hasSource ? 'stage' : 'library',
      selectedCandidateId,
    }
  }

  const handleServerSelect = (relativePath: string, name: string) => {
    setPickerOpen(false)
    setSelectedServerPath(relativePath)
    setPlaylistName(name)
  }

  const handleServerImport = () => {
    if (!selectedServerPath) return
    importMutation.mutate({ filePath: selectedServerPath }, {
      onSuccess: results => {
        setRows(results.map(makeRowState))
        setStage('review')
      },
    })
  }

  const handleFile = (file: File) => {
    if (!file.name.match(/\.m3u8?$/i)) {
      alert('Please select an .m3u or .m3u8 file')
      return
    }
    setPlaylistName(file.name.replace(/\.m3u8?$/i, ''))
    importMutation.mutate(file, {
      onSuccess: results => {
        setRows(results.map(makeRowState))
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

  const setRowMode = (i: number, mode: 'library' | 'stage') => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, mode, included: true } : r))
  }

  const selectCandidate = (i: number, candidateId: number) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, selectedCandidateId: candidateId, mode: 'library', included: true } : r))
  }

  const rejectAllCandidates = (i: number) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, selectedCandidateId: null, included: false } : r))
  }

  const includedCount = rows.filter(r => r.included).length
  const matchedCount = rows.filter(r => r.result.status === 'matched').length
  const reviewCount = rows.filter(r => r.result.status === 'low_confidence').length
  const unmatchedCount = rows.filter(r => r.result.status === 'unmatched').length

  const handleExport = () => {
    const tracks: TrackSelection[] = rows
      .filter(r => r.included)
      .map(r => {
        const selectedCandidate = getSelectedCandidate(r)
        return {
          title: r.result.entry.title ?? selectedCandidate?.title ?? 'Unknown',
          artist: r.result.entry.artist ?? selectedCandidate?.artist ?? 'Unknown',
          duration: r.result.entry.duration,
          mode: r.mode,
          itemPath: r.mode === 'library' ? (selectedCandidate?.path ?? null) : null,
          sourcePath: r.result.sourcePath,
        }
      })

    exportMutation.mutate(
      { playlistName, tracks, navidrome: ndConfig },
      {
        onSuccess: result => {
          const parts: string[] = []
          if (result.writtenTo) parts.push(`Written to ${result.writtenTo}`)
          if (result.postedToNavidrome) parts.push('Posted to Navidrome')
          if (result.stagedFiles > 0) parts.push(`${result.stagedFiles} track(s) moved to the playlist staging folder`)
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
    setSelectedServerPath(null)
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
            <p className="text-xs text-[var(--text-muted)] mt-1">Browse from your music directory to read file tags, or upload a local file</p>
          </div>

          {/* Mode tabs */}
          <div className="flex border-b border-[var(--border-subtle)]">
            {(['server', 'local'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setImportMode(mode)}
                className={`px-6 py-3 text-xs font-medium transition-colors ${
                  importMode === mode
                    ? 'text-purple-300 border-b-2 border-purple-500 -mb-px'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {mode === 'server' ? 'Browse server' : 'Upload file'}
              </button>
            ))}
          </div>

          <div className="p-8">
            {importMode === 'server' ? (
              <div className="space-y-4">
                <p className="text-xs text-[var(--text-muted)]">
                  Select an M3U file from your music directory. The server will read the audio file tags directly, giving much better matching results.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-purple-500/40 transition-all"
                  >
                    <svg className="w-4 h-4 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Browse…
                  </button>
                  {selectedServerPath && (
                    <span className="text-xs font-mono text-purple-300 truncate max-w-xs">{selectedServerPath}</span>
                  )}
                </div>
                {selectedServerPath && (
                  <button
                    onClick={handleServerImport}
                    disabled={importMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 disabled:opacity-40 disabled:cursor-not-allowed border border-purple-500/20 transition-all"
                  >
                    {importMutation.isPending ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
                        </svg>
                        Matching tracks…
                      </>
                    ) : 'Import playlist'}
                  </button>
                )}
              </div>
            ) : (
              <div>
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
              </div>
            )}
            {importMutation.error && (
              <p className="mt-3 text-xs text-red-400">{String(importMutation.error)}</p>
            )}
          </div>
        </div>
      )}

      {pickerOpen && <M3uPicker onSelect={handleServerSelect} onClose={() => setPickerOpen(false)} />}

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
                    const selectedCandidate = getSelectedCandidate(row)
                    const canInclude = row.result.status !== 'unmatched' || !!row.result.sourcePath
                    const canStage = !!row.result.sourcePath
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
                            <div className="space-y-1">
                              <span className={`text-xs font-medium ${statusColor(row.result)}`}>
                                {statusBadge(row.result)}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-[var(--text-muted)]/70">
                                <span>{modeBadge(row.mode)}</span>
                                {row.mode === 'stage' && <span className="text-orange-400">moving files</span>}
                              </div>
                            </div>
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
                          {selectedCandidate ? (
                            <div className="space-y-2">
                              <div>
                                <p className="text-[var(--text-secondary)] leading-tight">{selectedCandidate.title}</p>
                                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                                  {selectedCandidate.artist}
                                  {selectedCandidate.album ? ` · ${selectedCandidate.album}` : ''}
                                </p>
                                <p className="text-[11px] text-[var(--text-muted)]/75 mt-1">
                                  {candidateSummary(selectedCandidate)}
                                </p>
                              </div>

                              {row.result.candidates.length > 1 && (
                                <div className="flex flex-wrap gap-2">
                                  {row.result.candidates.slice(0, 4).map(candidate => {
                                    const active = candidate.id === selectedCandidate.id
                                    return (
                                      <button
                                        key={candidate.id}
                                        onClick={() => selectCandidate(i, candidate.id)}
                                        className={`rounded-lg border px-2.5 py-1 text-left transition-colors ${
                                          active
                                            ? 'border-purple-500/50 bg-purple-500/10 text-purple-200'
                                            : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:border-purple-500/30 hover:text-[var(--text-secondary)]'
                                        }`}
                                      >
                                        <div className="text-[11px] font-medium leading-tight">{candidate.title}</div>
                                        <div className="text-[10px] mt-0.5 opacity-80">{Math.round(candidate.confidence * 100)}%</div>
                                      </button>
                                    )
                                  })}
                                  <button
                                    onClick={() => rejectAllCandidates(i)}
                                    className="rounded-lg border px-2.5 py-1 text-[11px] border-red-500/40 bg-red-500/10 text-red-400 hover:text-red-300 transition-colors"
                                  >
                                    None of these
                                  </button>
                                </div>
                              )}

                              {canStage && (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => setRowMode(i, 'library')}
                                    className={`rounded-lg px-2.5 py-1 text-[11px] border transition-colors ${
                                      row.mode === 'library'
                                        ? 'border-green-500/40 bg-green-500/10 text-green-300'
                                        : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                                    }`}
                                  >
                                    Use library match
                                  </button>
                                  <button
                                    onClick={() => setRowMode(i, 'stage')}
                                    className={`rounded-lg px-2.5 py-1 text-[11px] border transition-colors ${
                                      row.mode === 'stage'
                                        ? 'border-orange-500/40 bg-orange-500/10 text-orange-300'
                                        : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                                    }`}
                                  >
                                    Stage to playlist folder
                                  </button>
                                </div>
                              )}
                            </div>
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
