import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isRefetchTrigger, parseEvent } from '@/lib/socketEvents'
import { STALE_ON_BLOCK, STALE_ON_PENDING } from '@/lib/queryKeys'

/**
 * SIP-50 event socket.
 *
 * The node exposes /events on its dedicated WebSocket port (6877 here) and, as
 * a side effect of both connectors sharing one servlet context, on the API port
 * as well - verified against v3.9.11: both deliver byte-identical events. We
 * follow the page origin, exactly as the API client does, so both take the same
 * route: same-origin in production, through the Vite proxy in development.
 *
 * No subscription message is needed; events arrive on connect.
 */
export function useNodeSocket() {
  const [connected, setConnected] = useState(false)
  const queryClient = useQueryClient()
  const retry = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    let socket: WebSocket | undefined
    let disposed = false

    const open = () => {
      if (disposed) return
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
      socket = new WebSocket(`${scheme}://${window.location.host}/events`)
      socket.onopen = () => setConnected(true)
      socket.onmessage = (event) => {
        const name = parseEvent(String(event.data))
        if (!isRefetchTrigger(name)) return
        for (const key of STALE_ON_PENDING) {
          void queryClient.invalidateQueries({ queryKey: [key] })
        }
        // A pending transaction changes only the pool; everything else is
        // confirmed state and waits for a block.
        if (name === 'BLOCK_PUSHED') {
          for (const key of STALE_ON_BLOCK) {
            void queryClient.invalidateQueries({ queryKey: [key] })
          }
        }
      }
      socket.onclose = () => {
        setConnected(false)
        if (!disposed) retry.current = setTimeout(open, 3000)
      }
      socket.onerror = () => socket?.close()
    }

    open()
    return () => {
      disposed = true
      if (retry.current) clearTimeout(retry.current)
      socket?.close()
    }
  }, [queryClient])

  return { connected }
}
