import {
  createContext, useCallback, useContext, useMemo, useState,
  type ReactNode,
} from 'react'
import { nextStyle, readStyle, type IdenticonStyle } from '@/lib/identicon'

interface IdenticonAPI {
  style: IdenticonStyle
  /** One step through IDENTICON_STYLES. The button has no other verb. */
  cycle: () => void
}

const Ctx = createContext<IdenticonAPI | null>(null)

const STORAGE_KEY = 'signum-identicon'

/**
 * One choice about how an account looks, for every place that draws one.
 *
 * It is context rather than a hook with local state because the control that
 * changes it sits in `AppHeader` while the pictures it changes are rows deep
 * inside the console — two subtrees that would otherwise each keep their own
 * copy and disagree.
 *
 * Unlike `MotionProvider` there is nothing to publish outside React: no
 * `data-*` attribute, no second engine reading the same preference. The value
 * is read by `<Identicon>` and by the button, and nowhere else.
 */
export function IdenticonProvider({ children }: { children: ReactNode }) {
  // Read before the first paint rather than in an effect, like `useBeginner`:
  // an effect runs after the frame, so a returning visitor would see every
  // identicon in the console drawn in the default style and then swap.
  const [style, setStyle] = useState<IdenticonStyle>(() => {
    try {
      return readStyle(localStorage.getItem(STORAGE_KEY))
    } catch {
      return readStyle(null)
    }
  })

  const cycle = useCallback(() => {
    setStyle((current) => {
      const next = nextStyle(current)
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        /* noop — a session that cannot remember still gets to look different */
      }
      return next
    })
  }, [])

  const value = useMemo<IdenticonAPI>(() => ({ style, cycle }), [style, cycle])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useIdenticon(): IdenticonAPI {
  const value = useContext(Ctx)
  if (!value) throw new Error('useIdenticon must be used within <IdenticonProvider>')
  return value
}
