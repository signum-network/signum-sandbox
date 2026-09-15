import { useRef } from 'react'
import { arrivals, type FeedSnapshot } from './arrivals'

const keyOf = (snapshot: FeedSnapshot) =>
  `${snapshot.page}|${snapshot.filter}|${snapshot.ids.join(',')}`

/**
 * `arrivals` for a component that only ever holds the current list.
 *
 * The comparison happens during render rather than in an effect, because the
 * answer is needed by the very render that first shows the new rows — an
 * effect would arrive one paint too late and the arrival would be missed.
 *
 * It is keyed on the content of the snapshot rather than on its identity, and
 * that is what makes it safe under StrictMode: a second render with the same
 * list recomputes nothing and, crucially, does not advance the remembered
 * snapshot past the arrival it just reported.
 */
export function useArrivals(snapshot: FeedSnapshot): Set<string> {
  const previous = useRef<FeedSnapshot | null>(null)
  const answer = useRef<Set<string>>(new Set())
  const key = useRef<string | null>(null)

  const next = keyOf(snapshot)
  if (key.current !== next) {
    answer.current = arrivals(previous.current, snapshot)
    previous.current = snapshot
    key.current = next
  }

  return answer.current
}
