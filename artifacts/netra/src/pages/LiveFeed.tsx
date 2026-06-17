import { useTranslation } from 'react-i18next'
import { useWebSocket } from '@/hooks/useWebSocket'
import { Wifi, WifiOff, Eye, Shield } from 'lucide-react'

interface FeedData {
  frame_b64?: string
  person_count?: number
  density?: number
  incident_type?: string
  severity?: number
  threat_score?: number
  threat_behaviors?: string[]
  zone?: string
  timestamp?: string
}

const BEHAVIOR_LABELS: Record<string, { label: string; color: string }> = {
  normal: { label: 'Normal', color: 'bg-green-100 text-green-800' },
  running: { label: 'Running', color: 'bg-amber-100 text-amber-800' },
  falling: { label: 'Falling', color: 'bg-red-100 text-red-800' },
  raised_hands: { label: 'Raised Hands', color: 'bg-orange-100 text-orange-800' },
  erratic: { label: 'Erratic Movement', color: 'bg-purple-100 text-purple-800' },
}

const TYPE_BADGE: Record<string, string> = {
  normal: 'bg-green-100 text-green-800 border-green-200',
  crowding: 'bg-amber-100 text-amber-800 border-amber-200',
  anomaly: 'bg-red-100 text-red-800 border-red-200',
  critical: 'bg-purple-100 text-purple-800 border-purple-200',
}

export default function LiveFeed() {
  const { t } = useTranslation()
  const { data, isConnected } = useWebSocket('/ws/feed')
  const fd = data as FeedData | null

  const density = fd?.density ?? 0
  const threatScore = fd?.threat_score ?? 0
  const incidentType = fd?.incident_type ?? 'normal'

  const densityColor =
    density > 65 ? '#ef4444' : density > 40 ? '#f59e0b' : '#10b981'
  const threatColor =
    threatScore > 70 ? '#8b5cf6' : threatScore > 50 ? '#ef4444' : threatScore > 30 ? '#f59e0b' : '#10b981'

  const circumference = 251.2
  const strokeOffset = circumference - (threatScore / 100) * circumference

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('liveFeed.title')}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Zone: {fd?.zone?.replace('_', ' ').toUpperCase() ?? '—'}
          </p>
        </div>
        <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full font-medium ${isConnected ? 'text-green-700 bg-green-50 border border-green-200' : 'text-muted-foreground bg-muted'}`}>
          {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
          {isConnected ? 'Connected' : 'Connecting...'}
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl overflow-hidden shadow-sm">
        <div className="relative bg-black min-h-[360px] flex items-center justify-center">
          {fd?.frame_b64 ? (
            <img
              src={`data:image/jpeg;base64,${fd.frame_b64}`}
              alt="Live feed"
              className="w-full h-auto max-h-[480px] object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-white/40">
              <Eye size={48} strokeWidth={1} />
              <p className="text-sm">
                {isConnected ? 'Awaiting frame...' : 'Connecting to camera feed...'}
              </p>
            </div>
          )}

          {/* Top-left: person count badge */}
          <div className="absolute top-3 left-3 bg-black/70 text-white text-sm font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
            <Eye size={14} />
            <span>{fd?.person_count ?? 0} persons</span>
          </div>

          {/* Top-right: LIVE indicator */}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <div className="bg-black/70 text-white text-xs font-bold px-2.5 py-1.5 rounded-full backdrop-blur-sm flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 pulse-dot" />
              <span>{t('liveFeed.aiActive')}</span>
            </div>
            {isConnected && (
              <div className="bg-red-600/90 text-white text-xs font-bold px-2.5 py-1.5 rounded-full backdrop-blur-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white pulse-dot" />
                {t('liveFeed.live')}
              </div>
            )}
          </div>

          {/* Bottom-left: density bar */}
          <div className="absolute bottom-3 left-3 bg-black/70 rounded-lg px-3 py-2 backdrop-blur-sm min-w-[160px]">
            <p className="text-white/70 text-[10px] font-medium uppercase tracking-wider mb-1">{t('liveFeed.density')}</p>
            <div className="w-full h-2 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${density}%`, backgroundColor: densityColor }}
              />
            </div>
            <p className="text-white text-xs font-bold mt-1">{density.toFixed(1)}%</p>
          </div>

          {/* Bottom-right: threat score ring */}
          <div className="absolute bottom-3 right-3 bg-black/70 rounded-lg p-2.5 backdrop-blur-sm flex items-center gap-2.5">
            <svg width="52" height="52" viewBox="0 0 52 52" className="-rotate-90">
              <circle cx="26" cy="26" r="20" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
              <circle
                cx="26" cy="26" r="20" fill="none"
                stroke={threatColor} strokeWidth="4"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
              />
            </svg>
            <div>
              <p className="text-white/70 text-[10px] uppercase tracking-wider">{t('liveFeed.threatScore')}</p>
              <p className="text-white text-lg font-bold leading-none">{threatScore}</p>
            </div>
          </div>
        </div>

        {/* Privacy notice */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 border-t border-primary/20">
          <Shield size={14} className="text-primary shrink-0" />
          <p className="text-xs text-primary font-medium">{t('liveFeed.privacy')}</p>
        </div>
      </div>

      {/* Incident type + behaviors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Incident Classification</p>
          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold border ${TYPE_BADGE[incidentType]}`}>
            {incidentType.toUpperCase()}
          </span>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Severity</span>
              <p className="font-bold text-lg">{fd?.severity ?? 0}<span className="text-muted-foreground text-sm font-normal">/100</span></p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Persons</span>
              <p className="font-bold text-lg">{fd?.person_count ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">{t('liveFeed.behaviors')}</p>
          <div className="flex flex-wrap gap-2">
            {(fd?.threat_behaviors ?? ['normal']).map((b) => {
              const info = BEHAVIOR_LABELS[b] ?? { label: b, color: 'bg-muted text-muted-foreground' }
              return (
                <span key={b} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${info.color}`}>
                  {info.label}
                </span>
              )
            })}
          </div>
          {fd?.timestamp && (
            <p className="text-[10px] text-muted-foreground mt-3">
              Last update: {new Date(fd.timestamp).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
