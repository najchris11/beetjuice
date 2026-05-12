interface Props {
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export default function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
  loading = false,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm fade-in">
      <div className="w-full max-w-md rounded-2xl bg-[var(--bg-card)] border border-[var(--border-default)] p-6 shadow-2xl shadow-black/50">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{title}</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed whitespace-pre-line">{description}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600/90 hover:bg-red-500 text-white transition-all disabled:opacity-50 shadow-lg shadow-red-500/20"
          >
            {loading ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
