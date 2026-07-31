'use client'

interface Props {
  value: boolean
  onToggle: () => void
  loading?: boolean
  color?: string
  size?: 'sm' | 'md'
}

export default function Toggle({ value, onToggle, loading = false, color = '#2A5F6B', size = 'md' }: Props) {
  const dimensions = size === 'sm'
    ? { btn: 'w-9 h-5', thumb: 'w-4 h-4', translate: 16 }
    : { btn: 'w-11 h-6', thumb: 'w-5 h-5', translate: 20 }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      aria-checked={value}
      role="switch"
      className={`relative ${dimensions.btn} rounded-full flex-shrink-0 transition-colors duration-200 focus:outline-none disabled:cursor-wait`}
      style={{ backgroundColor: value ? color : '#d1d5db' }}
    >
      {/* Thumb */}
      <span
        className={`absolute top-[2px] left-[2px] ${dimensions.thumb} bg-white rounded-full shadow-sm transition-transform duration-200`}
        style={{ transform: value ? `translateX(${dimensions.translate}px)` : 'translateX(0)' }}
      />
      {/* Loading pulse */}
      {loading && (
        <span className="absolute inset-0 rounded-full animate-pulse bg-white/30" />
      )}
    </button>
  )
}
