import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react'
import { MotionConfig } from 'framer-motion'
import { cssVariables } from './tokens'

interface MotionAPI {
  enabled: boolean
  setEnabled: (on: boolean) => void
}

const Ctx = createContext<MotionAPI | null>(null)

const STORAGE_KEY = 'signum-motion'
const REDUCE = '(prefers-reduced-motion: reduce)'

function systemPrefersReduce(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(REDUCE).matches
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * An explicit choice outranks the operating system in both directions — a
 * person who switched motion on despite their system setting has said what
 * they want, and so has one who switched it off on a machine that never
 * asked for less.
 */
export function resolvePreference(stored: string | null, prefersReduce: boolean): boolean {
  if (stored === 'on') return true
  if (stored === 'off') return false
  return !prefersReduce
}

/**
 * One decision about movement, in one place, for two engines.
 *
 * `data-motion` on the document element is what `motion.css` reads, the same
 * way `ThemeProvider` publishes `data-theme`. `MotionConfig` is what Framer
 * Motion reads. Both come from this one piece of state, so there is no second
 * place where "off" is only half true.
 *
 * One thing it cannot reach: Framer's imperative `animate()` ignores
 * `MotionConfig`. Anything animated that way asks `useMotion()` itself.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState<boolean>(() =>
    resolvePreference(readStored(), systemPrefersReduce()),
  )

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on)
    try {
      localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
    } catch {
      /* noop */
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.motion = enabled ? 'on' : 'off'
  }, [enabled])

  // The tokens reach CSS once. They are constants, so there is nothing to
  // keep in sync afterwards.
  useEffect(() => {
    const root = document.documentElement
    for (const [name, value] of Object.entries(cssVariables())) {
      root.style.setProperty(name, value)
    }
  }, [])

  const value = useMemo<MotionAPI>(() => ({ enabled, setEnabled }), [enabled, setEnabled])

  return (
    <Ctx.Provider value={value}>
      <MotionConfig reducedMotion={enabled ? 'never' : 'always'}>{children}</MotionConfig>
    </Ctx.Provider>
  )
}

export function useMotion(): MotionAPI {
  const value = useContext(Ctx)
  if (!value) throw new Error('useMotion must be used within <MotionProvider>')
  return value
}
