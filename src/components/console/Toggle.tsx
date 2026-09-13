import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { sfx, useAudio } from '@/audio'

/**
 * The console's checkbox: a small switch with a sliding knob, in the same
 * idiom as the rest of the tactical console rather than the browser's own
 * checkbox chrome. Disabled reads as a dimmed, inert control — not just a
 * click that silently does nothing — since auto-forge disables this without
 * a forger configured and that state needs to be seen, not discovered.
 */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  disabled?: boolean
}) {
  const { play } = useAudio()

  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className="flex items-center gap-2 text-[10px] uppercase tracking-[1px]"
      style={{
        color: checked ? 'var(--blue2)' : 'var(--muted)',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      whileHover={disabled ? undefined : { color: 'var(--blue2)' }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onClick={() => {
        if (disabled) return
        play(sfx.click)
        onChange(!checked)
      }}
    >
      <span
        className="relative inline-block h-[14px] w-[26px] shrink-0"
        style={{
          // No solid fill: the console is drawn in hairlines, and --blue as a
          // filled track was the one saturated block of colour in it. On reads
          // as the accent border and knob the rest of the app already uses.
          border: `1px solid ${checked ? 'var(--blue2)' : 'var(--border2)'}`,
          background: 'transparent',
        }}
      >
        <motion.span
          className="absolute top-[1px] h-[10px] w-[10px]"
          style={{ background: checked ? 'var(--blue2)' : 'var(--muted)' }}
          animate={{ left: checked ? '13px' : '1px' }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        />
      </span>
      {label}
    </motion.button>
  )
}
