import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isRefetchTrigger, parseEvent } from '@/lib/socketEvents'

/**
 * SIP-50 event socket.
 *
 * The node exposes /events on its dedicated WebSocket port (6877 here) and, as
 * a side effect of both connectors sharing one servlet context, on the API port
 * as well - verified against v3.9.11: both deliver byte-identical events. We
 * follow the page origin, which keeps the socket same-origin in production and
 * lets the Vite proxy handle development, with VITE_WS_URL as an escape hatch.
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
      const url = import.meta.env.VITE_WS_URL ?? `${scheme}://${window.location.host}/events`
      socket = new WebSocket(url)
      socket.onopen = () => setConnected(true)
      socket.onmessage = (event) => {
        if (isRefetchTrigger(parseEvent(String(event.data)))) {
          void queryClient.invalidateQueries({ queryKey: ['blockchainStatus'] })
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
