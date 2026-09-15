import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { sfx, useAudio } from '@/audio'
import { useMotion, SPRINGS, seconds } from '@/motion'

/**
 * The switch for movement, built like the one for sound beside it.
 *
 * Same box, same press, same icon cross-fade: they are the same kind of
 * thing — a preference about how loud the app is — and a person should not
 * have to learn two controls for that.
 */
export function MotionToggle() {
  const { t } = useTranslation()
  const { enabled, setEnabled } = useMotion()
  const { play } = useAudio()

  const handle = () => {
    // The pairing AudioToggle uses: the affirmative sound for turning
    // something on, the small one for turning it off.
    play(enabled ? sfx.tick : sfx.confirm)
    setEnabled(!enabled)
  }

  return (
    <motion.button
      type="button"
      onClick={handle}
      title={enabled ? t('motion.disable') : t('motion.enable')}
      className="flex h-7 w-7 items-center justify-center"
      style={{
        border: '1px solid var(--border)',
        color: enabled ? 'var(--blue2)' : 'var(--muted)',
      }}
      whileHover={{ borderColor: 'var(--border2)', scale: 1.05 }}
      whileTap={{ scale: 0.92 }}
      transition={SPRINGS.snap}
    >
      <AnimatePresence mode="wait" initial={false}>
        {enabled ? (
          <motion.svg
            key="on"
            width="14" height="14" viewBox="0 0 16 16" fill="none"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: seconds('instant') }}
          >
            <circle cx="4" cy="8" r="2" fill="currentColor" />
            <path
              d="M8.5 5.5 12 8l-3.5 2.5M12.5 4.5v7"
              stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"
            />
          </motion.svg>
        ) : (
          <motion.svg
            key="off"
            width="14" height="14" viewBox="0 0 16 16" fill="none"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: seconds('instant') }}
          >
            <circle cx="4" cy="8" r="2" fill="currentColor" />
            <path
              d="M12.5 4.5v7"
              stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"
            />
            <path
              d="M8 5.5l4 5M12 5.5l-4 5"
              stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.7"
            />
          </motion.svg>
        )}
      </AnimatePresence>
    </motion.button>
  )
}
