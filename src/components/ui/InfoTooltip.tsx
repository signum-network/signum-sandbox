import { useState, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

const TOOLTIP_WIDTH = 280
const VIEWPORT_MARGIN = 8
/** Enough to decide whether the panel still fits below its icon. */
const ESTIMATED_HEIGHT = 160

interface InfoTooltipProps {
  text: string
}

interface Placement {
  left: number
  /** Distance from the viewport edge the panel is anchored to. */
  offset: number
  above: boolean
}

export function InfoTooltip({ text }: InfoTooltipProps) {
  const [visible, setVisible] = useState(false)
  const [placement, setPlacement] = useState<Placement | null>(null)
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const anchor = ref.current
    if (!visible || !anchor) return

    const measure = () => {
      const rect = anchor.getBoundingClientRect()
      const above = rect.bottom + ESTIMATED_HEIGHT > window.innerHeight
      const centred = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2
      setPlacement({
        left: Math.max(
          VIEWPORT_MARGIN,
          Math.min(centred, window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN),
        ),
        offset: above ? window.innerHeight - rect.top + 6 : rect.bottom + 6,
        above,
      })
    }

    measure()
    // The icon moves with whatever it is attached to — a scrolling list, a
    // resized window — and a panel left at a stale rectangle points at
    // nothing. Capture phase, because the scroll happens on an inner
    // container rather than on the window.
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [visible])

  return (
    <span
      ref={ref}
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <span
        tabIndex={0}
        role="button"
        aria-label="More information"
        className="inline-flex h-[16px] w-[16px] cursor-default items-center justify-center rounded-full text-[10px] font-bold leading-none select-none"
        style={{
          border: '1px solid var(--muted)',
          color: 'var(--muted)',
          opacity: 0.6,
          transition: 'opacity 0.12s, border-color 0.12s, color 0.12s',
          ...(visible ? { opacity: 1, borderColor: 'var(--blue2)', color: 'var(--blue2)' } : {}),
        }}
      >
        i
      </span>

      {/*
        Rendered into the body rather than beside the icon.
        Absolutely positioned inside its parent, the panel was clipped by the
        first ancestor with a scrollbar — and in this app that is nearly every
        one of them: each list scrolls, the drawer scrolls, the account record
        scrolls. Clamping against the viewport cannot help when something
        smaller than the viewport is doing the cutting. A portal has no such
        ancestor, and the theme variables still reach it because they live on
        the document element.
      */}
      {visible &&
        placement &&
        createPortal(
          <span
            className="pointer-events-none fixed z-50 p-3 text-[12px] leading-relaxed"
            style={{
              width: TOOLTIP_WIDTH,
              left: placement.left,
              ...(placement.above
                ? { bottom: placement.offset }
                : { top: placement.offset }),
              background: 'var(--bg2)',
              border: '1px solid var(--border2)',
              color: 'var(--text)',
              boxShadow: '0 8px 32px rgba(0,0,0,.5)',
              // The body sets none of the console's typography, but say it
              // anyway: this panel must read as prose wherever it is opened
              // from, and half the labels that own one are set in uppercase.
              textTransform: 'none',
              letterSpacing: 'normal',
            }}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  )
}
