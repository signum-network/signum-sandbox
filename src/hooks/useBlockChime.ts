import { useEffect, useRef } from 'react'
import { useAudio, sfx } from '@/audio'

export function useBlockChime(height: number | null) {
  const { play } = useAudio()
  const previous = useRef<number | null>(null)

  useEffect(() => {
    if (height === null) return
    if (previous.current !== null && height > previous.current) play(sfx.chime)
    previous.current = height
  }, [height, play])
}
