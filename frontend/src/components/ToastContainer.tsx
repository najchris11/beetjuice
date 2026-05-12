import { useToasts, dismissToast, type Toast } from '../hooks/useToast.ts'

const typeStyles: Record<Toast['type'], { bg: string; border: string; icon: string }> = {
  success: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: '✓',
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    icon: '✕',
  },
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    icon: 'ℹ',
  },
}

const typeTextColors: Record<Toast['type'], string> = {
  success: 'text-emerald-300',
  error: 'text-red-300',
  info: 'text-blue-300',
}

export default function ToastContainer() {
  const toasts = useToasts()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => {
        const style = typeStyles[toast.type]
        const textColor = typeTextColors[toast.type]
        return (
          <div
            key={toast.id}
            className={`${style.bg} ${style.border} border rounded-xl px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-xl fade-in flex items-start gap-3`}
          >
            <span className={`${textColor} text-sm font-bold mt-0.5 shrink-0`}>
              {style.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${textColor}`}>{toast.message}</p>
              {toast.detail && (
                <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{toast.detail}</p>
              )}
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors shrink-0"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
