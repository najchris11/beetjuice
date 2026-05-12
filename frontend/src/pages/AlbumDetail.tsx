import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAlbum, useAlbumItems, useDeleteAlbum, useDeleteItem } from '../hooks/useBeets.ts'
import FormatBadge from '../components/FormatBadge.tsx'
import ConfirmDialog from '../components/ConfirmDialog.tsx'
import { addToast } from '../hooks/useToast.ts'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatBitrate(bps: number): string {
  return `${Math.round(bps / 1000)} kbps`
}

function formatSamplerate(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(hz % 1000 ? 1 : 0)} kHz` : `${hz} Hz`
}

function AlbumArtFallback({ name }: { name: string }) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const hue1 = hash % 360
  const hue2 = (hue1 + 40) % 360

  return (
    <div
      className="w-full h-full flex items-center justify-center rounded-xl"
      style={{
        background: `linear-gradient(135deg, hsl(${hue1}, 30%, 18%), hsl(${hue2}, 25%, 12%))`,
      }}
    >
      <svg className="w-16 h-16 text-white/20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
      </svg>
    </div>
  )
}

export default function AlbumDetail() {
  const { id } = useParams<{ id: string }>()
  const albumId = Number(id)
  const navigate = useNavigate()

  const { data: album, isLoading: albumLoading } = useAlbum(albumId)
  const { data: items, isLoading: itemsLoading } = useAlbumItems(albumId)
  const deleteAlbum = useDeleteAlbum()
  const deleteItem = useDeleteItem()

  const [confirmAlbum, setConfirmAlbum] = useState(false)
  const [confirmItem, setConfirmItem] = useState<number | null>(null)

  if (albumLoading || itemsLoading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="flex gap-6 mb-8">
          <div className="w-48 h-48 rounded-xl skeleton shrink-0" />
          <div className="space-y-3 flex-1">
            <div className="h-4 w-20 skeleton rounded" />
            <div className="h-8 w-64 skeleton rounded" />
            <div className="h-5 w-40 skeleton rounded" />
            <div className="h-4 w-32 skeleton rounded" />
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 skeleton rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (!album) {
    return (
      <div className="max-w-5xl mx-auto text-center py-24">
        <p className="text-[var(--text-muted)] text-sm">Album not found.</p>
        <Link to="/" className="text-purple-400 text-sm mt-2 inline-block hover:text-purple-300">
          ← Back to library
        </Link>
      </div>
    )
  }

  const confirmItemData = items?.find(i => i.id === confirmItem)
  const totalDuration = items?.reduce((sum, i) => sum + (i.length || 0), 0) ?? 0
  const formats = [...new Set(items?.map(i => i.format) ?? [])]

  return (
    <div className="max-w-5xl mx-auto space-y-8 fade-in">
      {/* Back link */}
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Library
      </Link>

      {/* Header */}
      <div className="flex gap-6">
        <div className="w-48 h-48 shrink-0 rounded-xl overflow-hidden bg-[var(--bg-secondary)] shadow-2xl shadow-black/30">
          <img
            src={`/api/albums/${album.id}/art`}
            alt={album.album}
            className="w-full h-full object-cover"
            onError={e => {
              const img = e.currentTarget as HTMLImageElement
              img.style.display = 'none'
              const fallback = img.nextElementSibling as HTMLElement
              if (fallback) fallback.style.display = 'flex'
            }}
          />
          <div className="w-full h-full hidden">
            <AlbumArtFallback name={album.album} />
          </div>
        </div>
        <div className="flex flex-col justify-end gap-1.5 min-w-0">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest font-medium">Album</p>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] truncate">{album.album}</h1>
          <p className="text-lg text-[var(--text-secondary)]">{album.albumartist}</p>
          <div className="flex items-center gap-3 mt-1 text-sm text-[var(--text-muted)] flex-wrap">
            {album.year > 0 && <span>{album.year}</span>}
            {album.genre && <span>{album.genre}</span>}
            {items && <span>{items.length} tracks</span>}
            <span>{formatDuration(totalDuration)}</span>
            <div className="flex gap-1.5">
              {formats.map(f => <FormatBadge key={f} format={f} size="xs" />)}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={() => setConfirmAlbum(true)}
              className="self-start px-4 py-1.5 rounded-lg text-sm font-medium bg-[var(--danger-subtle)] hover:bg-red-600/30 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 transition-all"
            >
              Delete album
            </button>
          </div>
        </div>
      </div>

      {/* Track list */}
      <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-xs text-[var(--text-muted)] uppercase tracking-wider">
              <th className="text-left px-4 py-3 w-12">#</th>
              <th className="text-left px-4 py-3">Title</th>
              <th className="text-left px-4 py-3 w-24">Format</th>
              <th className="text-left px-4 py-3 w-24">Bitrate</th>
              <th className="text-left px-4 py-3 w-24">Sample</th>
              <th className="text-left px-4 py-3 w-20">Duration</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {items?.map(item => (
              <tr key={item.id} className="border-b border-[var(--border-subtle)]/50 last:border-0 hover:bg-white/[0.02] transition-colors group">
                <td className="px-4 py-3 text-[var(--text-muted)] tabular-nums">{item.track || '—'}</td>
                <td className="px-4 py-3 text-[var(--text-primary)] font-medium">{item.title}</td>
                <td className="px-4 py-3"><FormatBadge format={item.format} /></td>
                <td className="px-4 py-3 text-[var(--text-muted)] tabular-nums font-mono text-xs">{formatBitrate(item.bitrate)}</td>
                <td className="px-4 py-3 text-[var(--text-muted)] tabular-nums font-mono text-xs">
                  {item.samplerate > 0 && formatSamplerate(item.samplerate)}
                  {item.bitdepth > 0 && <span className="text-[var(--text-muted)]/60 ml-1">/ {item.bitdepth}bit</span>}
                </td>
                <td className="px-4 py-3 text-[var(--text-muted)] tabular-nums">{formatDuration(item.length)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setConfirmItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-400 transition-all text-xs"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Album delete confirm */}
      {confirmAlbum && (
        <ConfirmDialog
          title="Delete album"
          description={`Permanently delete "${album.album}" by ${album.albumartist} and all its files? This cannot be undone.`}
          onConfirm={() => {
            deleteAlbum.mutate(album.id, {
              onSuccess: () => {
                addToast('success', 'Album deleted', `"${album.album}" by ${album.albumartist} has been removed.`)
                navigate('/')
              },
              onError: (err) => {
                addToast('error', 'Delete failed', String(err))
                setConfirmAlbum(false)
              },
            })
          }}
          onCancel={() => setConfirmAlbum(false)}
          loading={deleteAlbum.isPending}
        />
      )}

      {/* Track delete confirm */}
      {confirmItem !== null && confirmItemData && (
        <ConfirmDialog
          title="Delete track"
          description={`Permanently delete "${confirmItemData.title}" and its file? This cannot be undone.`}
          onConfirm={() => {
            deleteItem.mutate(confirmItem, {
              onSuccess: () => {
                addToast('success', 'Track deleted', `"${confirmItemData.title}" has been removed.`)
                setConfirmItem(null)
              },
              onError: (err) => {
                addToast('error', 'Delete failed', String(err))
                setConfirmItem(null)
              },
            })
          }}
          onCancel={() => setConfirmItem(null)}
          loading={deleteItem.isPending}
        />
      )}
    </div>
  )
}
