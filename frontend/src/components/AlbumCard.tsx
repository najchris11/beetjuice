import { Link } from 'react-router-dom'
import type { Album } from '../types/beets.ts'

interface Props {
  album: Album
  style?: React.CSSProperties
}

function AlbumArtFallback({ name }: { name: string }) {
  // Generate a deterministic gradient from the album name
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

export default function AlbumCard({ album, style }: Props) {
  return (
    <Link
      to={`/album/${album.id}`}
      className="group flex flex-col rounded-xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)] transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/5 fade-in-stagger"
      style={style}
    >
      <div className="aspect-square bg-[var(--bg-secondary)] overflow-hidden relative">
        <img
          src={`/api/albums/${album.id}/art`}
          alt={album.album}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          onError={e => {
            const img = e.currentTarget as HTMLImageElement
            img.style.display = 'none'
            // Show the fallback sibling
            const fallback = img.nextElementSibling as HTMLElement
            if (fallback) fallback.style.display = 'flex'
          }}
        />
        <div className="w-full h-full absolute inset-0 hidden">
          <AlbumArtFallback name={album.album} />
        </div>
      </div>
      <div className="p-3 space-y-0.5">
        <p className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-purple-300 transition-colors">
          {album.album}
        </p>
        <p className="text-xs text-[var(--text-muted)] truncate">{album.albumartist}</p>
        {album.year > 0 && (
          <p className="text-xs text-[var(--text-muted)]/60">{album.year}</p>
        )}
      </div>
    </Link>
  )
}
