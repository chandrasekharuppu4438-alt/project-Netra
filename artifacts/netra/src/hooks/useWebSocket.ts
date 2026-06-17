import { useEffect, useRef, useState, useCallback } from 'react'
import { WS_BASE } from '@/config'

interface UseWebSocketReturn {
  data: unknown
  isConnected: boolean
  error: string | null
}

export function useWebSocket(path: string): UseWebSocketReturn {
  const [data, setData] = useState<unknown>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    try {
      const url = `${WS_BASE}${path}`
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) return
        setIsConnected(true)
        setError(null)
      }

      ws.onmessage = (event) => {
        if (!mountedRef.current) return
        try {
          const parsed = JSON.parse(event.data)
          setData(parsed)
        } catch {
          setData(event.data)
        }
      }

      ws.onerror = () => {
        if (!mountedRef.current) return
        setError('WebSocket connection error')
        setIsConnected(false)
      }

      ws.onclose = () => {
        if (!mountedRef.current) return
        setIsConnected(false)
        reconnectTimerRef.current = setTimeout(() => {
          if (mountedRef.current) connect()
        }, 3000)
      }
    } catch (err) {
      setError('Failed to connect to WebSocket')
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connect()
      }, 3000)
    }
  }, [path])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
      }
    }
  }, [connect])

  return { data, isConnected, error }
}
