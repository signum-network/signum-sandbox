import { useEffect } from 'react'
import { useAudio, sfx } from '@/audio'

/**
 * The chime for a new block, given the pulse that noticed it.
 *
 * It used to watch the height itself, which made it the only place in the app
 * that knew a block had arrived — and left the console, the screen built for
 * watching the chain, silent. Now it is handed the observation, so the sound
 * and the movement cannot disagree about whether anything happened.
 */
export function useBlockChime(pulse: number) {
  const { play } = useAudio()

  useEffect(() => {
    if (pulse === 0) return
    play(sfx.chime)
  }, [pulse, play])
}
