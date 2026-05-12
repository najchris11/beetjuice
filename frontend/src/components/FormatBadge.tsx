const formatConfig: Record<string, { bg: string; text: string; glow?: string }> = {
  FLAC:  { bg: 'bg-blue-500/15', text: 'text-blue-300', glow: 'shadow-blue-500/10' },
  MP3:   { bg: 'bg-amber-500/15', text: 'text-amber-300' },
  AAC:   { bg: 'bg-orange-500/15', text: 'text-orange-300' },
  ALAC:  { bg: 'bg-violet-500/15', text: 'text-violet-300', glow: 'shadow-violet-500/10' },
  DSD:   { bg: 'bg-emerald-500/15', text: 'text-emerald-300', glow: 'shadow-emerald-500/10' },
  DSF:   { bg: 'bg-emerald-500/15', text: 'text-emerald-300', glow: 'shadow-emerald-500/10' },
  DFF:   { bg: 'bg-emerald-500/15', text: 'text-emerald-300' },
  OGG:   { bg: 'bg-pink-500/15', text: 'text-pink-300' },
  OPUS:  { bg: 'bg-pink-500/15', text: 'text-pink-300' },
  WAV:   { bg: 'bg-cyan-500/15', text: 'text-cyan-300' },
  AIFF:  { bg: 'bg-cyan-500/15', text: 'text-cyan-300' },
}

const losslessFormats = new Set(['FLAC', 'ALAC', 'DSD', 'DSF', 'DFF', 'WAV', 'AIFF'])

export function isLossless(format: string): boolean {
  return losslessFormats.has(format.toUpperCase())
}

export default function FormatBadge({ format, size = 'sm' }: { format: string; size?: 'sm' | 'xs' }) {
  const key = format.toUpperCase()
  const cfg = formatConfig[key] ?? { bg: 'bg-gray-500/15', text: 'text-gray-400' }
  const sizeClass = size === 'xs' ? 'text-[10px] px-1 py-px' : 'text-xs px-1.5 py-0.5'

  return (
    <span className={`inline-flex items-center rounded-md font-mono font-semibold ${sizeClass} ${cfg.bg} ${cfg.text} ${cfg.glow ? `shadow-sm ${cfg.glow}` : ''}`}>
      {format}
      {isLossless(key) && (
        <svg className="ml-0.5 w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      )}
    </span>
  )
}
