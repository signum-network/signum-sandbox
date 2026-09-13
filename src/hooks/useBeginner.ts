import { useCallback, useState } from 'react'
import { readBeginner, writeBeginner, type BeginnerState } from '@/lib/beginner'

const STORAGE_KEY = 'signum-sandbox.beginner.v1'

export interface BeginnerStore extends BeginnerState {
  /** Answers the entry question, and later flips the switch in the help drawer. */
  setBeginner: (beginner: boolean) => void
}

/**
 * Beginner mode, kept across sessions. It holds no secret and reveals
 * nothing, so unlike the account store it needs no network rail.
 */
export function useBeginner(): BeginnerStore {
  // Read before the first paint, not in an effect. An effect runs after the
  // frame, so a returning visitor would see "New here, or an old hand?" flash
  // over an empty console on every reload — and could click it, overwriting
  // the answer they gave and starting a tour they did not ask for. Nothing
  // here is secret or network-dependent, so there is nothing to wait for.
  const [state, setState] = useState<BeginnerState>(() =>
    readBeginner(window.localStorage.getItem(STORAGE_KEY)),
  )

  const setBeginner = useCallback((beginner: boolean) => {
    setState({ answered: true, beginner })
    window.localStorage.setItem(STORAGE_KEY, writeBeginner(beginner))
  }, [])

  return { ...state, setBeginner }
}
