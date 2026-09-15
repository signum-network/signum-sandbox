import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTheme } from '@/theme/ThemeProvider'
import { seconds } from './tokens'

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
          initial={{ opacity: 0.22 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: seconds('quick') }}
          onAnimationComplete={() => setFlash(0)}
        />
      )}
    </AnimatePresence>
  )
}
