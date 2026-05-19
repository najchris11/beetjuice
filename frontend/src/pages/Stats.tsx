import { Link } from 'react-router-dom'
import { useStats } from '../hooks/useBeets.ts'

export default function Stats() {
  const { data: stats, isLoading, error } = useStats()

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <div className="h-8 w-40 skeleton rounded mb-2" />
          <div className="h-4 w-60 skeleton rounded" />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[var(--border-subtle)] p-6 skeleton" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="rounded-xl bg-[var(--danger-subtle)] border border-red-500/20 p-6 text-red-300 text-sm">
          <p className="font-medium mb-1">Failed to load statistics</p>
          <p className="text-red-400/80 text-xs">{String(error)}</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="max-w-3xl mx-auto text-center py-24">
        <p className="text-[var(--text-muted)] text-sm">No statistics available.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1">Library Stats</h1>
        <p className="text-[var(--text-muted)] text-sm">Overview of your music library</p>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-2">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">Albums</p>
          <p className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-violet-300 bg-clip-text text-transparent">
            {stats.albums.toLocaleString()}
          </p>
          <p className="text-xs text-[var(--text-muted)]/60 mt-2">Total albums in library</p>
        </div>

        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-2">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">Tracks</p>
          <p className="text-4xl font-bold bg-gradient-to-r from-amber-400 to-orange-300 bg-clip-text text-transparent">
            {stats.items.toLocaleString()}
          </p>
          <p className="text-xs text-[var(--text-muted)]/60 mt-2">Total tracks across all albums</p>
        </div>

        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-2">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">Avg Tracks per Album</p>
          <p className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            {(stats.items / Math.max(stats.albums, 1)).toFixed(1)}
          </p>
          <p className="text-xs text-[var(--text-muted)]/60 mt-2">Average number of tracks</p>
        </div>

        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-2">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">Coverage</p>
          <p className="text-4xl font-bold text-emerald-300">
            {Math.round((100 * stats.items) / Math.max(stats.albums * 10, 1))}%
          </p>
          <p className="text-xs text-[var(--text-muted)]/60 mt-2">Estimated library fullness</p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <p className="text-sm font-medium text-[var(--text-primary)] mb-3">Quick Actions</p>
        <div className="flex gap-2">
          <Link
            to="/"
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--accent-subtle)] text-purple-300 hover:bg-purple-500/20 transition-all"
          >
            Browse Library
          </Link>
          <Link
            to="/duplicates"
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/[0.04] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.08] transition-all"
          >
            Find Duplicates
          </Link>
        </div>
      </div>
    </div>
  )
}
