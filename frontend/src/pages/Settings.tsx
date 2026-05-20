import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTestNavidrome } from '../hooks/useBeets.ts'
import type { NavidromeConfig } from '../types/playlists.ts'

const ND_STORAGE_KEY = 'beetjuice:navidrome-config'

function loadNavidromeConfig(): NavidromeConfig {
  try {
    const raw = localStorage.getItem(ND_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

interface CheckResult {
  ok: boolean
  label: string
  detail: string
  fix?: string[]
}

interface HealthResult {
  ok: boolean
  checks: Record<string, CheckResult>
}

function DirPicker({ value, onChange, placeholder, root = 'library' }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  root?: 'library' | 'music'
}) {
  const [open, setOpen] = useState(false)
  const [browsePath, setBrowsePath] = useState('')

  const { data, isFetching } = useQuery({
    queryKey: ['dirs', root, browsePath],
    queryFn: (): Promise<{ dirs: string[] }> =>
      fetch(`/api/playlists/dirs?path=${encodeURIComponent(browsePath)}&root=${root}`).then(r => r.json()),
    enabled: open,
    staleTime: 30_000,
  })

  const openBrowser = () => {
    setBrowsePath(value || '')
    setOpen(true)
  }

  const segments = browsePath.split('/').filter(Boolean)

  const navigate = (dir: string) =>
    setBrowsePath(browsePath ? `${browsePath}/${dir}` : dir)

  const navigateTo = (i: number) =>
    setBrowsePath(segments.slice(0, i + 1).join('/'))

  const select = () => { onChange(browsePath); setOpen(false) }

  return (
    <>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:border-purple-500/50 font-mono"
        />
        <button
          type="button"
          onClick={openBrowser}
          className="px-2.5 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-purple-500/40 transition-all"
          title="Browse directories"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </svg>
        </button>
      </div>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="relative w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: '70vh' }}>
            {/* Header */}
            <div className="px-5 py-4 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] shrink-0">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Select folder</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Browsing from {root === 'music' ? 'music root (MUSIC_PATH)' : 'library root (BEETS_LIBRARY_PATH)'}
              </p>
            </div>

            {/* Breadcrumb */}
            <div className="px-4 py-2.5 bg-[var(--bg-secondary)]/60 border-b border-[var(--border-subtle)] flex items-center gap-1 flex-wrap text-xs shrink-0">
              <button
                onClick={() => setBrowsePath('')}
                className={`font-mono transition-colors ${!browsePath ? 'text-[var(--text-primary)] font-semibold' : 'text-purple-400 hover:text-purple-300'}`}
              >
                /
              </button>
              {segments.map((seg, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="text-[var(--text-muted)]/30">/</span>
                  <button
                    onClick={() => navigateTo(i)}
                    className={`font-mono transition-colors ${i === segments.length - 1 ? 'text-[var(--text-primary)] font-semibold' : 'text-purple-400 hover:text-purple-300'}`}
                  >
                    {seg}
                  </button>
                </span>
              ))}
            </div>

            {/* Dir list */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {isFetching ? (
                <div className="flex justify-center py-12">
                  <svg className="w-5 h-5 animate-spin text-[var(--text-muted)]/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
                  </svg>
                </div>
              ) : !data?.dirs.length ? (
                <p className="text-center text-xs text-[var(--text-muted)] py-12">No subdirectories here</p>
              ) : (
                data.dirs.map(dir => (
                  <button
                    key={dir}
                    onClick={() => navigate(dir)}
                    className="w-full px-5 py-3 text-left text-sm text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)] transition-colors flex items-center gap-3 group border-b border-[var(--border-subtle)]/30 last:border-0"
                  >
                    <svg className="w-4 h-4 text-[var(--text-muted)]/50 shrink-0 group-hover:text-purple-400/70 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                    </svg>
                    <span className="flex-1 font-mono text-xs">{dir}</span>
                    <svg className="w-3.5 h-3.5 text-[var(--text-muted)]/30 group-hover:text-[var(--text-muted)]/70 transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-[var(--bg-secondary)] border-t border-[var(--border-subtle)] flex items-center gap-3 shrink-0">
              <span className="flex-1 text-xs text-[var(--text-muted)] font-mono truncate">
                {browsePath ? `/${browsePath}` : '/'}
              </span>
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors shrink-0"
              >
                Cancel
              </button>
              <button
                onClick={select}
                className="px-4 py-1.5 text-sm rounded-lg bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/20 font-medium transition-all shrink-0"
              >
                Select here
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

function ConfigItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[var(--border-subtle)]/50 last:border-0">
      <p className="text-sm text-[var(--text-muted)] font-medium shrink-0">{label}</p>
      <p className={`text-sm text-[var(--text-secondary)] text-right break-all ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </p>
    </div>
  )
}

function CheckRow({ check }: { check: CheckResult }) {
  const [expanded, setExpanded] = useState(!check.ok)

  return (
    <div className={`rounded-lg border px-4 py-3 space-y-2 ${
      check.ok
        ? 'border-green-500/20 bg-green-500/5'
        : 'border-red-500/20 bg-red-500/5'
    }`}>
      <div className="flex items-start gap-3">
        {check.ok ? (
          <svg className="w-4 h-4 text-green-400 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${check.ok ? 'text-green-300' : 'text-red-300'}`}>
            {check.label}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{check.detail}</p>
        </div>
        {!check.ok && check.fix && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-red-400 hover:text-red-300 shrink-0 transition-colors"
          >
            {expanded ? 'Hide fix' : 'How to fix'}
          </button>
        )}
      </div>

      {!check.ok && check.fix && expanded && (
        <div className="ml-7 space-y-1.5 pt-1 border-t border-red-500/15">
          <p className="text-xs font-medium text-red-300/80 pt-1">Steps to fix:</p>
          {check.fix.map((step, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-xs text-red-400/60 shrink-0 tabular-nums">{i + 1}.</span>
              <pre className="text-xs text-red-200/70 whitespace-pre-wrap break-all font-mono leading-relaxed">
                {step}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Settings() {
  const { data: config } = useQuery<{ beetsApiUrl: string; musicPath: string; beetsLibraryPath: string }>({
    queryKey: ['config'],
    queryFn: () => fetch('/api/config').then(r => r.json()),
  })

  const [diagStatus, setDiagStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [health, setHealth] = useState<HealthResult | null>(null)

  const [ndConfig, setNdConfig] = useState<NavidromeConfig>(loadNavidromeConfig)
  const [ndSaved, setNdSaved] = useState(false)
  const testNavidrome = useTestNavidrome()

  useEffect(() => { setNdSaved(false) }, [ndConfig])

  const saveNdConfig = () => {
    localStorage.setItem(ND_STORAGE_KEY, JSON.stringify(ndConfig))
    setNdSaved(true)
  }

  const testConnection = () => {
    if (!ndConfig.url || !ndConfig.username || !ndConfig.password) return
    testNavidrome.mutate({ url: ndConfig.url, username: ndConfig.username, password: ndConfig.password })
  }

  const runDiagnostics = async () => {
    setDiagStatus('running')
    try {
      const result: HealthResult = await fetch('/api/health').then(r => r.json())
      setHealth(result)
    } finally {
      setDiagStatus('done')
    }
  }

  const checkList = health ? Object.values(health.checks) : []

  return (
    <div className="max-w-3xl mx-auto space-y-8 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1">Settings</h1>
        <p className="text-[var(--text-muted)] text-sm">Configuration and diagnostics</p>
      </div>

      {/* Diagnostics */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
        <div className="px-6 py-4 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Diagnostics</h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Test connectivity to the beets API and verify the music library mount
            </p>
          </div>

          {health && (
            <div className={`flex items-center gap-1.5 text-xs font-medium shrink-0 ${
              health.ok ? 'text-green-400' : 'text-red-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${health.ok ? 'bg-green-400' : 'bg-red-400'}`} />
              {health.ok ? 'All systems go' : `${checkList.filter(c => !c.ok).length} issue${checkList.filter(c => !c.ok).length !== 1 ? 's' : ''} found`}
            </div>
          )}
        </div>

        <div className="p-6 space-y-3">
          {diagStatus === 'idle' && (
            <p className="text-sm text-[var(--text-muted)]">
              Run diagnostics to check that beetjuice can reach the beets API and access your music library.
            </p>
          )}

          {checkList.map(check => (
            <CheckRow key={check.label} check={check} />
          ))}

          <button
            onClick={runDiagnostics}
            disabled={diagStatus === 'running'}
            className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-purple-500/20"
          >
            {diagStatus === 'running' ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
                </svg>
                Running…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
                {diagStatus === 'done' ? 'Run Again' : 'Run Diagnostics'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Backend Config */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
        <div className="px-6 py-4 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Configuration</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">Runtime environment variables</p>
        </div>
        <div className="px-6 py-4 space-y-0">
          <ConfigItem label="Beets API URL" value={config?.beetsApiUrl ?? '…'} mono />
          <ConfigItem label="Music Path" value={config?.musicPath ?? '…'} mono />
          <ConfigItem label="Beets Library Path" value={config?.beetsLibraryPath ?? '…'} mono />
          <ConfigItem
            label="Environment"
            value={import.meta.env.MODE === 'production' ? 'Production' : 'Development'}
          />
        </div>
      </div>

      {/* Navidrome */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
        <div className="px-6 py-4 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Navidrome</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">Configure Navidrome integration for playlist export</p>
        </div>
        <div className="p-6 space-y-4">
          {[
            { key: 'url', label: 'Navidrome URL', placeholder: 'http://navidrome:4533', type: 'url' },
            { key: 'username', label: 'Username', placeholder: 'admin', type: 'text' },
            { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
          ].map(({ key, label, placeholder, type }) => (
            <div key={key}>
              <label className="block text-xs text-[var(--text-muted)] font-medium mb-1.5">{label}</label>
              <input
                type={type}
                value={(ndConfig[key as keyof NavidromeConfig] as string) ?? ''}
                onChange={e => setNdConfig(c => ({ ...c, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:border-purple-500/50 font-mono"
              />
            </div>
          ))}

          <div>
            <label className="block text-xs text-[var(--text-muted)] font-medium mb-1.5">Playlists Path</label>
            <DirPicker
              value={ndConfig.playlistsPath ?? ''}
              onChange={v => setNdConfig(c => ({ ...c, playlistsPath: v }))}
              placeholder="_playlists (relative to library root)"
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]/60">Where .m3u files are written for Navidrome to pick up</p>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] font-medium mb-1.5">Staging Folder</label>
            <DirPicker
              value={ndConfig.stagingFolder ?? ''}
              onChange={v => setNdConfig(c => ({ ...c, stagingFolder: v }))}
              placeholder="_import (relative to music root)"
              root="music"
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]/60">Unmatched tracks are copied here for beets to import — browse from your full music mount</p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={saveNdConfig}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/20 transition-all"
            >
              {ndSaved ? 'Saved' : 'Save'}
            </button>
            <button
              onClick={testConnection}
              disabled={!ndConfig.url || !ndConfig.username || !ndConfig.password || testNavidrome.isPending}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white/[0.04] text-[var(--text-muted)] hover:bg-white/[0.08] hover:text-[var(--text-secondary)] disabled:opacity-40 disabled:cursor-not-allowed border border-[var(--border-subtle)] transition-all"
            >
              {testNavidrome.isPending ? 'Testing…' : 'Test Connection'}
            </button>
            {testNavidrome.data && (
              <span className={`text-xs font-medium ${testNavidrome.data.ok ? 'text-green-400' : 'text-red-400'}`}>
                {testNavidrome.data.message}
              </span>
            )}
            {testNavidrome.error && (
              <span className="text-xs text-red-400">{String(testNavidrome.error)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <p className="text-sm font-medium text-[var(--text-primary)] mb-3">Quick Navigation</p>
        <div className="flex flex-wrap gap-2">
          <Link to="/" className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--accent-subtle)] text-purple-300 hover:bg-purple-500/20 transition-all">
            Library
          </Link>
          <Link to="/stats" className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/[0.04] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.08] transition-all">
            Statistics
          </Link>
          <Link to="/duplicates" className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/[0.04] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.08] transition-all">
            Duplicates
          </Link>
        </div>
      </div>
    </div>
  )
}
