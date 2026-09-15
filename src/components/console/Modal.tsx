import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { RowButton } from './ConsoleButton'
import { SPRINGS, seconds } from '@/motion'

/**
 * A panel over the page, for content too large to unfold in place.
 *
 * Rendered through a portal into the document body for the same reason the
 * tooltip is: nearly every container in this console scrolls, and a scrolling
 * ancestor clips whatever overflows it. The theme variables live on the
 * document element, so they still reach it.
 *
 * Escape closes it, and so does the backdrop — the two gestures a person
 * tries without being told. The dialog stops its own clicks so pressing
 * inside does not dismiss it.
 */
export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  /**
   * Kept mounted while closed so it has something to animate out of. The
   * caller renders <Modal open={…}> rather than {… && <Modal>}.
   */
  open: boolean
  title: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()

  // Bound only while open, which it should always have been: a closed modal
  // has no business holding a listener on the document.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          className="fixed inset-0 z-[60] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,.55)' }}
          onClick={onClose}
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: seconds('quick') }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className="flex max-h-[80vh] w-full max-w-3xl flex-col border p-4"
            style={{ background: 'var(--bg2)', borderColor: 'var(--blue2)' }}
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={SPRINGS.panel}
          >
            <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
              <span className="text-[13px] uppercase tracking-[1px] text-[var(--blue3)]">
                {title}
              </span>
              <RowButton className="text-[13px] text-[var(--muted)]" onClick={onClose}>
                ✕ {t('console.drawer.close')}
              </RowButton>
            </div>
            <div className="themed-scroll console-scroll min-h-0 flex-1 overflow-auto">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
