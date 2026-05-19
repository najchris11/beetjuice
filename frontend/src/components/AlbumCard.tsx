import { Link } from 'react-router-dom'
import type { AlbumSummary } from '../types/beets.ts'
import FormatBadge from './FormatBadge.tsx'

interface Props {
  album: AlbumSummary
  style?: React.CSSProperties
  selectMode?: boolean
  selected?: boolean
  onSelect?: (id: number) => void
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function AlbumArtFallback({ name }: { name: string }) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const hue1 = hash % 360
  const hue2 = (hue1 + 40) % 360

  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{
        background: `linear-gradient(135deg, hsl(${hue1}, 30%, 18%), hsl(${hue2}, 25%, 12%))`,
      }}
    >
      <svg className="w-10 h-10 text-white/20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
      </svg>
    </div>
  )
}

export default function AlbumCard({ album, style, selectMode, selected, onSelect }: Props) {
  const inner = (
    <>
      <div className="aspect-square bg-[var(--bg-secondary)] overflow-hidden relative">
        <img
          src={`/api/albums/${album.id}/art`}
          alt={album.album}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          onError={e => {
            const img = e.currentTarget as HTMLImageElement
            img.style.display = 'none'
            const fallback = img.nextElementSibling as HTMLElement
            if (fallback) fallback.style.display = 'flex'
          }}
        />
        <div className="w-full h-full absolute inset-0 hidden">
          <AlbumArtFallback name={album.album} />
        </div>

        {/* Format badge — top-left */}
        {album.primaryFormat && (
          <div className="absolute top-1.5 left-1.5">
            <FormatBadge format={album.primaryFormat} size="xs" />
          </div>
        )}

        {/* Checkbox overlay in select mode */}
        {selectMode && (
          <div className={`absolute inset-0 transition-colors ${selected ? 'bg-purple-500/20' : 'bg-transparent'}`}>
            <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
              selected
                ? 'bg-purple-500 border-purple-400'
                : 'bg-black/40 border-white/40 group-hover:border-white/70'
            }`}>
              {selected && (
                <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 space-y-0.5">
        <p className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-purple-300 transition-colors">
          {album.album}
        </p>
        <p className="text-xs text-[var(--text-muted)] truncate">{album.albumartist}</p>
        <div className="flex items-center gap-2">
          {album.year > 0 && (
            <p className="text-xs text-[var(--text-muted)]/60">{album.year}</p>
          )}
          {album.totalSize > 0 && (
            <p className="text-xs text-[var(--text-muted)]/60">
              {formatBytes(album.totalSize)}
            </p>
          )}
        </div>
      </div>
    </>
  )

  const cardClass = `group flex flex-col rounded-xl overflow-hidden bg-[var(--bg-card)] border transition-all duration-200 fade-in-stagger ${
    selected
      ? 'border-purple-500/50 shadow-lg shadow-purple-500/10'
      : 'border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)] hover:shadow-lg hover:shadow-purple-500/5'
  }`

  if (selectMode) {
    return (
      <button
        onClick={() => onSelect?.(album.id)}
        className={`${cardClass} text-left w-full cursor-pointer`}
        style={style}
      >
        {inner}
      </button>
    )
  }

  return (
    <Link to={`/album/${album.id}`} className={cardClass} style={style}>
      {inner}
    </Link>
  )
}
