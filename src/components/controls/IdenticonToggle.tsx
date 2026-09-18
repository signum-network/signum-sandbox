import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { sfx, useAudio } from '@/audio'
import { SPRINGS, seconds } from '@/motion'
import { useIdenticon } from '@/identicon'
import { Identicon } from '@/components/Identicon'

/**
 * A fixed string rather than a real address, so the preview cannot change
 * identity when accounts come and go. Only the style it is drawn in changes.
 */
const SAMPLE_SEED = 'signum-sandbox'

/**
 * The switch for what an account looks like, built like the two beside it.
 *
 * Where those cross-fade between an on icon and an off icon, this one shows
 * the thing itself: an identicon of one fixed seed in the current style. Three
 * states cannot be read from a single glyph, and a drawing of "rings" or "a
 * grid" would be an abstraction of something we can simply render.
 *
 * No colour change between states — there is no "enabled" here to signal, and
 * the picture already says which style is on.
 */
export function IdenticonToggle() {
  const { t } = useTranslation()
  const { style, cycle } = useIdenticon()
  const { play } = useAudio()

  const handle = () => {
    // The neutral one of the pair its neighbours use. A cycle has no "on", so
    // `confirm` would say something untrue on two clicks out of three.
    play(sfx.tick)
    cycle()
  }

  return (
    <motion.button
      type="button"
      onClick={handle}
      title={t('identicon.cycle')}
      className="flex h-7 w-7 items-center justify-center"
      style={{ border: '1px solid var(--border)' }}
      whileHover={{ borderColor: 'var(--border2)', scale: 1.05 }}
      whileTap={{ scale: 0.92 }}
      transition={SPRINGS.snap}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={style}
          className="flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ duration: seconds('instant') }}
        >
          <Identicon value={SAMPLE_SEED} size={14} />
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}
