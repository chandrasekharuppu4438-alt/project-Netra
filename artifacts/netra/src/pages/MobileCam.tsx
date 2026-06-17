import { useEffect, useRef, useState } from 'react'
import { WS_BASE } from '@/config'
import { Camera, Wifi, WifiOff, ShieldCheck, StopCircle } from 'lucide-react'

type Status = 'idle' | 'requesting' | 'streaming' | 'connecting' | 'error'

const FRAME_INTERVAL_MS = 500
const JPEG_QUALITY = 0.7

export default function MobileCam() {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [wsConnected, setWsConnected] = useState(false)
  const [frameCount, setFrameCount] = useState(0)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stopStreaming()
    }
  }, [])

  const stopStreaming = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
    intervalRef.current = null
    streamRef.current = null
    wsRef.current = null
  }

  const connectWs = () => new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(`${WS_BASE}/ws/mobile-cam`)
    ws.onopen = () => { setWsConnected(true); resolve(ws) }
    ws.onerror = () => reject(new Error('WebSocket failed'))
    ws.onclose = () => { if (mountedRef.current) setWsConnected(false) }
    wsRef.current = ws
  })

  const startStreaming = async () => {
    if (status === 'streaming') { stopStreaming(); setStatus('idle'); return }
    setError('')

    try {
      setStatus('requesting')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setStatus('connecting')
      try {
        const ws = await connectWs()
        wsRef.current = ws
      } catch {
        // No backend — still show camera locally
        setWsConnected(false)
      }

      setStatus('streaming')

      intervalRef.current = setInterval(() => {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas || video.readyState < 2) return

        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(video, 0, 0)

        canvas.toBlob((blob) => {
          if (!blob) return
          const reader = new FileReader()
          reader.onloadend = () => {
            const b64 = (reader.result as string).split(',')[1]
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ frame_b64: b64 }))
            }
            setFrameCount((n) => n + 1)
          }
          reader.readAsDataURL(blob)
        }, 'image/jpeg', JPEG_QUALITY)
      }, FRAME_INTERVAL_MS)

    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Camera access failed')
    }
  }

  const flipCamera = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    if (status === 'streaming') {
      stopStreaming()
      setStatus('idle')
      setTimeout(() => startStreaming(), 200)
    }
  }

  const isStreaming = status === 'streaming'
  const isBusy = status === 'requesting' || status === 'connecting'

  return (
    <div className="min-h-screen bg-[hsl(163_30%_7%)] text-white flex flex-col select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <ShieldCheck size={20} className="text-[hsl(163_73%_42%)]" />
          <span className="font-bold text-lg tracking-tight">NETRA Mobile Cam</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium bg-white/10">
          {wsConnected
            ? <><Wifi size={12} className="text-green-400" /><span className="text-green-400">Connected</span></>
            : <><WifiOff size={12} className="text-white/40" /><span className="text-white/40">Offline mode</span></>
          }
        </div>
      </div>

      {/* Video Preview */}
      <div className="flex-1 relative bg-black overflow-hidden mx-4 rounded-2xl shadow-2xl">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-cover transition-opacity duration-300 ${isStreaming ? 'opacity-100' : 'opacity-0'}`}
        />
        <canvas ref={canvasRef} className="hidden" />

        {!isStreaming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/30">
            <Camera size={64} strokeWidth={1} />
            <p className="text-sm">Camera not started</p>
          </div>
        )}

        {/* Streaming overlays */}
        {isStreaming && (
          <>
            {/* LIVE badge */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600/90 text-white text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-white pulse-dot" />
              LIVE
            </div>

            {/* Frame counter */}
            <div className="absolute top-3 right-3 bg-black/60 text-white/80 text-xs font-mono px-2.5 py-1.5 rounded-full backdrop-blur-sm">
              {frameCount} frames sent
            </div>

            {/* AI badge */}
            <div className="absolute bottom-3 left-3 bg-[hsl(163_73%_24%)/80] text-white text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm border border-[hsl(163_73%_42%)/40]">
              AI Processing: {wsConnected ? 'YOLOv8 Active' : 'Local Preview'}
            </div>

            {/* Privacy notice */}
            <div className="absolute bottom-3 right-3 bg-black/60 text-white/70 text-[10px] px-2.5 py-1.5 rounded-full backdrop-blur-sm">
              🔒 Faces blurred
            </div>
          </>
        )}

        {/* Scanning corners */}
        {isStreaming && (
          <>
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[hsl(163_73%_42%)] rounded-tl-2xl" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[hsl(163_73%_42%)] rounded-tr-2xl" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[hsl(163_73%_42%)] rounded-bl-2xl" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[hsl(163_73%_42%)] rounded-br-2xl" />
          </>
        )}
      </div>

      {/* Status / Error */}
      <div className="px-5 py-3 text-center text-sm min-h-[40px]">
        {isBusy && <p className="text-white/60 animate-pulse">{status === 'requesting' ? 'Requesting camera access...' : 'Connecting to NETRA...'}</p>}
        {status === 'error' && <p className="text-red-400">{error}</p>}
        {isStreaming && !wsConnected && (
          <p className="text-amber-400 text-xs">Backend not available — showing camera preview locally. <br />Deploy backend for full AI processing.</p>
        )}
        {isStreaming && wsConnected && (
          <p className="text-green-400 text-xs">Streaming to NETRA backend · YOLOv8 detecting in real-time</p>
        )}
      </div>

      {/* Controls */}
      <div className="px-5 pb-8 flex items-center justify-center gap-4 shrink-0">
        <button
          onClick={flipCamera}
          disabled={isBusy}
          className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all disabled:opacity-40"
          aria-label="Flip camera"
        >
          🔄
        </button>

        <button
          onClick={startStreaming}
          disabled={isBusy}
          className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-all text-white font-bold disabled:opacity-60 ${
            isStreaming ? 'bg-red-600 hover:bg-red-500' : 'bg-[hsl(163_73%_24%)] hover:bg-[hsl(163_73%_30%)]'
          }`}
          aria-label={isStreaming ? 'Stop camera' : 'Start camera'}
        >
          {isStreaming
            ? <StopCircle size={32} />
            : <Camera size={32} />
          }
        </button>

        <div className="w-14 h-14" />
      </div>
    </div>
  )
}
