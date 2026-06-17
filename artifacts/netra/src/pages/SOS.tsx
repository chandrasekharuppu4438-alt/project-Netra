import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useSubmitSOS } from '@workspace/api-client-react'
import { CheckCircle, Phone } from 'lucide-react'
import type { SOSInput } from '@workspace/api-client-react'

type SOSState = 'idle' | 'locating' | 'recording' | 'sending' | 'done' | 'error'

const EMERGENCY_CONTACTS = [
  { label: 'police', number: '100', emoji: '🚔', color: 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100' },
  { label: 'ambulance', number: '108', emoji: '🚑', color: 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100' },
  { label: 'fire', number: '101', emoji: '🚒', color: 'bg-orange-50 border-orange-200 text-orange-800 hover:bg-orange-100' },
  { label: 'women', number: '1091', emoji: '👩', color: 'bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100' },
]

export default function SOS() {
  const { t } = useTranslation()
  const [state, setState] = useState<SOSState>('idle')
  const [countdown, setCountdown] = useState(5)
  const [referenceNum, setReferenceNum] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const submitMutation = useSubmitSOS()

  const handleSOS = async () => {
    if (state !== 'idle') return
    setErrorMsg('')

    try {
      setState('locating')
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
      })
      const { latitude, longitude } = position.coords

      setState('recording')
      let voiceB64: string | null = null

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const recorder = new MediaRecorder(stream)
        mediaRecorderRef.current = recorder
        chunksRef.current = []

        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
        recorder.start()

        let count = 5
        setCountdown(count)
        await new Promise<void>((resolve) => {
          const timer = setInterval(() => {
            count--
            setCountdown(count)
            if (count <= 0) {
              clearInterval(timer)
              recorder.stop()
              stream.getTracks().forEach((t) => t.stop())
              resolve()
            }
          }, 1000)
        })

        await new Promise<void>((resolve) => {
          recorder.onstop = () => resolve()
        })

        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
          voiceB64 = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => {
              const result = reader.result as string
              resolve(result.split(',')[1] ?? '')
            }
            reader.readAsDataURL(blob)
          })
        }
      } catch {
        // Microphone not available — continue without voice note
      }

      setState('sending')
      const payload: SOSInput = { latitude, longitude, voice_note_b64: voiceB64, citizen_id: null, photo_b64: null }
      const result = await submitMutation.mutateAsync({ data: payload })
      setReferenceNum(result.reference ?? 'SOS-' + Math.random().toString(36).slice(2, 6).toUpperCase())
      setState('done')
    } catch (err) {
      setState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send SOS')
    }
  }

  const buttonLabel = {
    idle: t('sos.press'),
    locating: 'Getting your location...',
    recording: `${t('sos.recording')} ${countdown}...`,
    sending: t('sos.sending') ?? 'Sending...',
    done: t('sos.sent'),
    error: 'Try again',
  }[state]

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t('sos.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          One press to alert authorities and share your location.
        </p>
      </div>

      {state === 'done' ? (
        <div className="flex flex-col items-center gap-5 py-10">
          <div className="w-24 h-24 rounded-full bg-green-50 border-4 border-green-200 flex items-center justify-center animate-in zoom-in duration-300">
            <CheckCircle size={48} className="text-green-600" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-green-700">{t('sos.sent')}</h2>
            <p className="text-muted-foreground mt-1">{t('sos.stayCalm')}</p>
            <div className="mt-3 bg-muted/60 rounded-lg px-4 py-2.5 inline-block">
              <span className="text-xs text-muted-foreground">Reference: </span>
              <span className="font-mono font-bold">{referenceNum}</span>
            </div>
          </div>
          <button
            onClick={() => { setState('idle'); setReferenceNum('') }}
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            Return to SOS screen
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 py-8">
          {/* SOS Button */}
          <div className="relative">
            {(state === 'idle' || state === 'error') && (
              <div className="absolute inset-0 rounded-full bg-red-500/20 scale-110 animate-ping" />
            )}
            <button
              onClick={handleSOS}
              disabled={state !== 'idle' && state !== 'error'}
              className={`relative w-36 h-36 rounded-full font-black text-white text-xl shadow-2xl transition-all duration-200 active:scale-95 select-none ${
                state === 'idle' || state === 'error'
                  ? 'bg-red-600 hover:bg-red-500 cursor-pointer'
                  : state === 'done'
                  ? 'bg-green-600'
                  : 'bg-red-400 cursor-wait'
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-3xl">🆘</span>
                <span className="text-sm font-bold leading-tight text-center px-2">
                  {state === 'recording' ? countdown.toString() : 'SOS'}
                </span>
              </div>
            </button>
          </div>

          <div className="text-center">
            <p className={`font-semibold ${state === 'error' ? 'text-red-600' : 'text-foreground'}`}>
              {buttonLabel}
            </p>
            {state === 'error' && errorMsg && (
              <p className="text-xs text-muted-foreground mt-1">{errorMsg}</p>
            )}
            {state === 'recording' && (
              <div className="flex justify-center gap-1.5 mt-3">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-red-500 typing-dot"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Pressing SOS will record your location and a 5-second voice note, then alert emergency services.
          </p>
        </div>
      )}

      {/* Emergency Contacts */}
      <div>
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Phone size={14} />
          {t('sos.emergency')}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {EMERGENCY_CONTACTS.map((contact) => (
            <a
              key={contact.number}
              href={`tel:${contact.number}`}
              className={`flex items-center gap-3 p-3 rounded-xl border font-semibold transition-colors ${contact.color}`}
            >
              <span className="text-xl">{contact.emoji}</span>
              <div>
                <p className="text-sm">{t(`sos.${contact.label}`)}</p>
                <p className="text-lg font-black">{contact.number}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
