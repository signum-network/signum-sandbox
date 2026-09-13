import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sfx, useAudio } from '@/audio'

export interface SelectOption {
  value: string
  label: string
  /** A dimmer second line under the label — e.g. an account's address. */
  sublabel?: string
  /** Shown before the label, in the trigger as well as in the list. */
  icon?: ReactNode
}

/**
 * The console's dropdown: a button that opens a popover list, in the same
 * idiom as ThemeSwitcher (border-on-hover button, AnimatePresence spring
 * panel, swish/tick/click on open/hover/choose) rather than the browser's
 * own <select> chrome. Every native <select> in the console is built from
 * this one component so there is a single place that owns "what a dropdown
 * looks like here."
 */
export function Select({
  value,
  options,
  placeholder,
  emptyLabel,
  onChange,
  disabled,
}: {
  value: string
  options: SelectOption[]
  placeholder: string
  /**
   * Shown inside the panel when there is nothing to choose. Without it an
   * empty list rendered the placeholder as its single line, which read as an
   * option — "Forger" looked like an account called Forger.
   */
  emptyLabel?: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { play } = useAudio()
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <motion.button
        type="button"
        className="flex w-full items-center justify-between gap-2 border bg-transparent px-2 py-1 text-left text-[11px]"
        style={{
          borderColor: 'var(--border)',
          color: current ? 'var(--fg)' : 'var(--muted)',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
        whileHover={disabled ? undefined : { borderColor: 'var(--border2)', color: 'var(--blue2)' }}
        whileTap={disabled ? undefined : { scale: 0.98 }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return
          setOpen((o) => {
            if (!o) play(sfx.swish)
            return !o
          })
        }}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {current ? (
            <>
              {current.icon}
              <span className="truncate">
                {current.label}
                {current.sublabel && (
                  <span style={{ color: 'var(--muted)' }}> · {current.sublabel}</span>
                )}
              </span>
            </>
          ) : (
            placeholder
          )}
        </span>
        <Chevron open={open} />
      </motion.button>

      <AnimatePresence>
        {open && !disabled && (
          <motion.div
            key="select-panel"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="themed-scroll absolute left-0 top-full z-50 mt-1 max-h-56 w-full overflow-y-auto"
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border2)',
              boxShadow: '0 16px 48px rgba(0,0,0,.4)',
            }}
            role="listbox"
          >
            {options.length === 0 && (
              <p className="px-2 py-1.5 text-[10px]" style={{ color: 'var(--muted)' }}>
                {emptyLabel ?? '—'}
              </p>
            )}
            {options.map((o) => (
              <motion.button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px]"
                style={{
                  background: o.value === value ? 'rgba(255,255,255,.05)' : 'transparent',
                  color: 'var(--fg)',
                }}
                whileHover={{ backgroundColor: 'rgba(255,255,255,.07)', color: 'var(--blue2)' }}
                onHoverStart={() => play(sfx.tick)}
                onClick={() => {
                  play(sfx.click)
                  onChange(o.value)
                  setOpen(false)
                }}
              >
                {o.icon}
                <span className="flex min-w-0 flex-col items-start">
                  <span className="truncate">{o.label}</span>
                  {o.sublabel && (
                    <span className="truncate text-[9px]" style={{ color: 'var(--muted)' }}>
                      {o.sublabel}
                    </span>
                  )}
                </span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <motion.svg
      width="8" height="8" viewBox="0 0 8 8" fill="none"
      animate={{ rotate: open ? 180 : 0 }}
      transition={{ duration: 0.18 }}
      style={{ flexShrink: 0 }}
    >
      <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </motion.svg>
  )
}
