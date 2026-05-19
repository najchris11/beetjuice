import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

function ConfigItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[var(--border-subtle)]/50 last:border-0">
      <p className="text-sm text-[var(--text-muted)] font-medium">{label}</p>
      <p className={`text-sm text-[var(--text-secondary)] flex-1 text-right ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </p>
    </div>
  )
}

export default function Settings() {
  const { data: config } = useQuery<{ beetsApiUrl: string; musicPath: string }>({
    queryKey: ['config'],
    queryFn: () => fetch('/api/config').then(r => r.json()),
  })

  return (
    <div className="max-w-3xl mx-auto space-y-8 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1">Settings</h1>
        <p className="text-[var(--text-muted)] text-sm">Read-only configuration</p>
      </div>

      {/* Backend Config */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
        <div className="px-6 py-4 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Backend Configuration</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">Beets API connection details</p>
        </div>
        <div className="px-6 py-4 space-y-0">
          <ConfigItem
            label="Beets API URL"
            value={config?.beetsApiUrl ?? '…'}
            mono
          />
          <ConfigItem
            label="Music Path"
            value={config?.musicPath ?? '…'}
            mono
          />
          <ConfigItem
            label="Status"
            value="Connected"
          />
          <ConfigItem
            label="Protocol"
            value="HTTP"
          />
        </div>
      </div>

      {/* Environment */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
        <div className="px-6 py-4 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Environment</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">Application information</p>
        </div>
        <div className="px-6 py-4 space-y-0">
          <ConfigItem
            label="App Name"
            value="beetjuice"
          />
          <ConfigItem
            label="Version"
            value="1.0.0"
          />
          <ConfigItem
            label="Environment"
            value={import.meta.env.MODE === 'production' ? 'Production' : 'Development'}
          />
          <ConfigItem
            label="Build Date"
            value={new Date().toLocaleDateString()}
          />
        </div>
      </div>

      {/* Features */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
        <div className="px-6 py-4 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Features</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">Enabled capabilities</p>
        </div>
        <div className="px-6 py-4 space-y-0">
          <ConfigItem
            label="Library Browsing"
            value="✓ Enabled"
          />
          <ConfigItem
            label="Duplicate Detection"
            value="✓ Enabled"
          />
          <ConfigItem
            label="Album Deletion"
            value="✓ Enabled"
          />
          <ConfigItem
            label="Track Management"
            value="✓ Enabled"
          />
          <ConfigItem
            label="Cover Art"
            value="✓ Enabled"
          />
        </div>
      </div>

      {/* Tips */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-blue-500/10 p-6 space-y-3">
        <div className="flex gap-2">
          <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-blue-300">Tips</p>
            <ul className="text-xs text-blue-200/80 space-y-1">
              <li>• Configure <code className="bg-blue-900/40 px-1.5 py-0.5 rounded">BEETS_API_URL</code> environment variable on your server</li>
              <li>• The Beets web plugin requires <code className="bg-blue-900/40 px-1.5 py-0.5 rounded">readonly: false</code> in your beets config</li>
              <li>• File deletion works via the Beets CLI command <code className="bg-blue-900/40 px-1.5 py-0.5 rounded">beet remove --delete</code></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <p className="text-sm font-medium text-[var(--text-primary)] mb-3">Quick Navigation</p>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/"
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--accent-subtle)] text-purple-300 hover:bg-purple-500/20 transition-all"
          >
            Library
          </Link>
          <Link
            to="/stats"
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/[0.04] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.08] transition-all"
          >
            Statistics
          </Link>
          <Link
            to="/duplicates"
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/[0.04] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.08] transition-all"
          >
            Duplicates
          </Link>
        </div>
      </div>
    </div>
  )
}
