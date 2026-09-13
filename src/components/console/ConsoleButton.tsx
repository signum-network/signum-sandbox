import { motion } from 'framer-motion'
import type { CSSProperties, ReactNode } from 'react'
import { sfx, useAudio } from '@/audio'

/**
 * The console's button, and the only place that decides what pressing one
 * feels and sounds like. Every bordered action in the console goes through
 * it, so the click is never forgotten on the twentieth button the way it was
 * when each one was written by hand.
 */
export function ConsoleButton({
  children,
  onClick,
  disabled,
  active,
  title,
  style,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  /** Drawn as the current choice — used where a button doubles as a state. */
  active?: boolean
  title?: string
  style?: CSSProperties
}) {
  const { play } = useAudio()

  return (
    <motion.button
      type="button"
      title={title}
      disabled={disabled}
      className="border px-3 py-1 text-[10px] uppercase tracking-[1px]"
      style={{
        borderColor: active ? 'var(--blue2)' : 'var(--border2)',
        color: disabled ? 'var(--muted)' : 'var(--blue3)',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
      whileHover={disabled ? undefined : { borderColor: 'var(--blue2)' }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onHoverStart={() => {
        if (!disabled) play(sfx.hover)
      }}
      onClick={() => {
        if (disabled) return
        play(sfx.click)
        onClick()
      }}
    >
      {children}
    </motion.button>
  )
}

/**
 * A row that opens: transparent, aligned with the text around it, and quiet
 * on hover. A list can hold dozens of these, so the hover tick that suits a
 * handful of action buttons would be a machine gun here — only the press
 * makes a sound.
 */
export function RowButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  className?: string
}) {
  const { play } = useAudio()

  return (
    <button
      type="button"
      disabled={disabled}
      className={className}
      onClick={() => {
        if (disabled) return
        play(sfx.click)
        onClick()
      }}
    >
      {children}
    </button>
  )
}
