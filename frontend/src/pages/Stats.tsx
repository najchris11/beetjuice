import { Link } from 'react-router-dom'
import { useStats } from '../hooks/useBeets.ts'
import { formatBytes, formatDurationLong } from '../utils/format.ts'

function StatCard({ label, value, sub, gradient }: { label: string; value: string; sub?: string; gradient: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-2">
      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-4xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
        {value}
      </p>
      {sub && <p className="text-xs text-[var(--text-muted)]/60 mt-2">{sub}</p>}
    </div>
  )
}

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
          {Array.from({ length: 6 }).map((_, i) => (
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

  const formatEntries = stats.formatCounts
    ? Object.entries(stats.formatCounts).sort((a, b) => b[1] - a[1])
    : []
  const totalTracksWithFormat = formatEntries.reduce((s, [, n]) => s + n, 0)

  return (
    <div className="max-w-3xl mx-auto space-y-8 fade-in">
      <div>
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1">Library Stats</h1>
        <p className="text-[var(--text-muted)] text-sm">Overview of your music library</p>
      </div>

      {/* Core counts */}
      <div className="grid md:grid-cols-2 gap-4">
        <StatCard
          label="Albums"
          value={stats.albums.toLocaleString()}
          sub="Total albums in library"
          gradient="from-purple-400 to-violet-300"
        />
        <StatCard
          label="Tracks"
          value={stats.items.toLocaleString()}
          sub={`~${(stats.items / Math.max(stats.albums, 1)).toFixed(1)} tracks per album`}
          gradient="from-amber-400 to-orange-300"
        />
        <StatCard
          label="Total Size"
          value={formatBytes(stats.totalSize ?? 0)}
          sub={stats.totalSize ? `~${formatBytes(Math.round((stats.totalSize ?? 0) / Math.max(stats.albums, 1)))} per album` : 'Browse the library to compute'}
          gradient="from-blue-400 to-cyan-300"
        />
        <StatCard
          label="Total Duration"
          value={formatDurationLong(stats.totalDuration ?? 0)}
          sub={stats.totalDuration ? undefined : 'Browse the library to compute'}
          gradient="from-emerald-400 to-teal-300"
        />
      </div>

      {/* Format breakdown */}
      {formatEntries.length > 0 && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
          <div className="px-6 py-4 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Format Breakdown</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Tracks by audio format</p>
          </div>
          <div className="p-6 space-y-3">
            {formatEntries.map(([fmt, count]) => {
              const pct = totalTracksWithFormat > 0 ? (count / totalTracksWithFormat) * 100 : 0
              return (
                <div key={fmt} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--text-secondary)]">{fmt}</span>
                    <span className="text-[var(--text-muted)] tabular-nums">
                      {count.toLocaleString()} tracks · {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-400 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!stats.formatCounts && (
        <p className="text-xs text-[var(--text-muted)] text-center">
          Format breakdown available after the library cache warms up — browse to the Library page first.
        </p>
      )}

      {/* Quick Actions */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <p className="text-sm font-medium text-[var(--text-primary)] mb-3">Quick Actions</p>
        <div className="flex gap-2">
          <Link to="/" className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--accent-subtle)] text-purple-300 hover:bg-purple-500/20 transition-all">
            Browse Library
          </Link>
          <Link to="/duplicates" className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/[0.04] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.08] transition-all">
            Find Duplicates
          </Link>
        </div>
      </div>
    </div>
  )
}
