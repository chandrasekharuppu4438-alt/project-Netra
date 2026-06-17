import { useEffect, useRef, useState } from 'react'
import i18n from 'i18next'
import { useWebSocket } from '@/hooks/useWebSocket'
import { X, AlertTriangle } from 'lucide-react'

interface AlertData {
  zone?: string
  type?: string
  severity?: number
  level?: string
  timestamp?: string
  voice_text_en?: string
  voice_text_hi?: string
  voice_text_te?: string
}

const LEVEL_STYLES: Record<string, { bar: string; bg: string; text: string; badge: string }> = {
  log: { bar: 'bg-blue-500', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-900', badge: 'bg-blue-100 text-blue-800' },
  municipal: { bar: 'bg-amber-500', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-900', badge: 'bg-amber-100 text-amber-800' },
  police: { bar: 'bg-red-500', bg: 'bg-red-50 border-red-200', text: 'text-red-900', badge: 'bg-red-100 text-red-800' },
  emergency: { bar: 'bg-purple-600', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-900', badge: 'bg-purple-100 text-purple-800' },
}

export default function VoiceAlert() {
  const { data } = useWebSocket('/ws/alerts')
  const [currentAlert, setCurrentAlert] = useState<AlertData | null>(null)
  const [visible, setVisible] = useState(false)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seenRef = useRef<string>('')

  useEffect(() => {
    if (!data) return
    const alert = data as AlertData
    const severity = alert.severity ?? 0
    if (severity < 50) return

    const key = JSON.stringify({ zone: alert.zone, type: alert.type, timestamp: alert.timestamp })
    if (key === seenRef.current) return
    seenRef.current = key

    setCurrentAlert(alert)
    setVisible(true)

    // Speak alert
    try {
      const lang = i18n.language
      let text = alert.voice_text_en ?? ''
      if (lang === 'hi') text = alert.voice_text_hi ?? text
      if (lang === 'te') text = alert.voice_text_te ?? text

      if (text && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = lang === 'hi' ? 'hi-IN' : lang === 'te' ? 'te-IN' : 'en-IN'
        utterance.rate = 0.9
        window.speechSynthesis.speak(utterance)
      }
    } catch { /* speech not available */ }

    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)

    // Emergency stays until manual close; others auto-dismiss
    if (severity < 80) {
      dismissTimerRef.current = setTimeout(() => setVisible(false), 8000)
    }
  }, [data])

  const dismiss = () => {
    setVisible(false)
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
  }

  if (!visible || !currentAlert) return null

  const level = currentAlert.level ?? 'log'
  const styles = LEVEL_STYLES[level] ?? LEVEL_STYLES.log

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[100] border-b ${styles.bg} ${styles.text} shadow-lg animate-in slide-in-from-top duration-300`}
    >
      <div className={`h-1 ${styles.bar} w-full`} />
      <div className="flex items-center justify-between px-4 py-3 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <AlertTriangle size={18} className="shrink-0" />
          <div>
            <span className="font-bold text-sm">
              {currentAlert.zone?.replace('_', ' ').toUpperCase()} — {currentAlert.type?.toUpperCase()}
            </span>
            <span className="text-xs ml-2 opacity-70">
              {currentAlert.timestamp ? new Date(currentAlert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${styles.badge}`}>
            {level.toUpperCase()}
          </span>
          <span className="text-sm font-bold">Severity: {currentAlert.severity}</span>
          <button onClick={dismiss} className="opacity-60 hover:opacity-100 transition-opacity ml-1">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
