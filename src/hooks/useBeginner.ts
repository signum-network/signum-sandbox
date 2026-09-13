import { useCallback, useEffect, useState } from 'react'
import { NOT_ASKED, readBeginner, writeBeginner, type BeginnerState } from '@/lib/beginner'

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
  const [state, setState] = useState<BeginnerState>(NOT_ASKED)

  useEffect(() => {
    setState(readBeginner(window.localStorage.getItem(STORAGE_KEY)))
  }, [])

  const setBeginner = useCallback((beginner: boolean) => {
    setState({ answered: true, beginner })
    window.localStorage.setItem(STORAGE_KEY, writeBeginner(beginner))
  }, [])

  return { ...state, setBeginner }
}
