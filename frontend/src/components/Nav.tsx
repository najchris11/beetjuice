import { NavLink } from 'react-router-dom'
import { useStats } from '../hooks/useBeets.ts'

export default function Nav() {
  const { data: stats } = useStats()

  return (
    <nav className="sticky top-0 z-40 backdrop-blur-xl bg-[var(--bg-primary)]/80 border-b border-[var(--border-subtle)]">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-8">
        <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-purple-400 to-violet-300 bg-clip-text text-transparent">
          beetjuice
        </span>
        <div className="flex gap-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-[var(--accent-subtle)] text-purple-300'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04]'
              }`
            }
          >
            Library
          </NavLink>
          <NavLink
            to="/duplicates"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-[var(--accent-subtle)] text-purple-300'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04]'
              }`
            }
          >
            Duplicates
          </NavLink>
          <NavLink
            to="/stats"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-[var(--accent-subtle)] text-purple-300'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04]'
              }`
            }
          >
            Stats
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-[var(--accent-subtle)] text-purple-300'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04]'
              }`
            }
          >
            Settings
          </NavLink>
        </div>
        {stats && (
          <div className="ml-auto flex items-center gap-3 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
              {stats.albums.toLocaleString()} albums
            </span>
            <span className="text-[var(--border-default)]">·</span>
            <span>{stats.items.toLocaleString()} tracks</span>
          </div>
        )}
      </div>
    </nav>
  )
}
