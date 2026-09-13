import { useCallback, useEffect, useRef, useState } from 'react'
import { sfx, useAudio } from '@/audio'
import { TOUR_STEPS, isStepComplete, type Observation, type TourStep } from '@/lib/tour'

export interface TourStore {
  active: boolean
  step: TourStep | null
  /** 1-based, for "step 4 of 18". */
  position: number
  total: number
  start: () => void
  stop: () => void
  /** Finishes an acknowledge step. Does nothing on a step the chain must answer. */
  acknowledge: () => void
}

/**
 * Which step is showing, and when it gives way to the next.
 *
 * The hook watches the observation it is handed and advances by itself: the
 * user forges a block because they wanted to, not because a "next" button was
 * waiting. Steps that only explain something have no chain answer, so those
 * get the button instead — that is what `acknowledge` is.
 */
export function useTour(observation: Observation): TourStore {
  const [index, setIndex] = useState<number | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const { play } = useAudio()

  // The observation as it stood when this step began, so "the height rose"
  // measures from here. A ref and not state: writing it must not itself cause
  // the render that would overwrite it.
  const baseline = useRef(observation)

  const step = index === null ? null : (TOUR_STEPS[index] ?? null)

  useEffect(() => {
    if (index === null || !step) return
    if (!isStepComplete(step, observation, baseline.current, acknowledged)) return
    play(sfx.confirm)
    const next = index + 1
    if (next >= TOUR_STEPS.length) {
      setIndex(null)
      return
    }
    baseline.current = observation
    setAcknowledged(false)
    setIndex(next)
  }, [index, step, observation, acknowledged, play])

  const start = useCallback(() => {
    baseline.current = observation
    setAcknowledged(false)
    setIndex(0)
  }, [observation])

  return {
    active: index !== null,
    step,
    position: (index ?? 0) + 1,
    total: TOUR_STEPS.length,
    start,
    stop: () => setIndex(null),
    acknowledge: () => setAcknowledged(true),
  }
}
