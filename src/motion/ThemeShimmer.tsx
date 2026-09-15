import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTheme } from '@/theme/ThemeProvider'
import { seconds, EASINGS } from './tokens'

/**
 * The flash that covers a theme swap.
 *
 * CSS custom properties do not interpolate without `@property`, so the
 * palette changes in a single frame however it is triggered. Rather than
 * registering every colour in the theme, the swap is covered: a brief wash in
 * the new accent, which also gives `sfx.themeChange` something to accompany.
 *
 * It renders nothing until the theme has actually changed once, so a page
 * load does not open with a flash of colour.
 */
export function ThemeShimmer() {
  const { theme } = useTheme()
  const first = useRef(true)
  const [flash, setFlash] = useState(0)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setFlash((n) => n + 1)
  }, [theme])

  return (
    <AnimatePresence>
      {flash > 0 && (
        <motion.div
          key={flash}
          className="pointer-events-none fixed inset-0 z-20"
          style={{ background: 'var(--blue2)' }}
          initial={{ opacity: 0 }}
          /*
            An envelope, not a fade: up in about 60ms, then the rest of the
            half second spent coming down. It used to start at full strength
            and only fall, which is why it read as a blink however long the
            fall was — there was no arrival to see, just a departure.

            Two segments, two curves: the accent rises with the same ease-out
            an arriving row uses, and the long way down is eased at both ends
            so it never looks like a linear dimmer being turned.
          */
          animate={{ opacity: [0, 0.22, 0] }}
          exit={{ opacity: 0 }}
          transition={{
            duration: seconds('calm'),
            times: [0, 0.12, 1],
            ease: [EASINGS.out, EASINGS.inOut],
          }}
          onAnimationComplete={() => setFlash(0)}
        />
      )}
    </AnimatePresence>
  )
}
