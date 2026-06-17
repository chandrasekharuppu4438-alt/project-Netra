import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGetIncidentStats, useGetForecast } from '@workspace/api-client-react'
import { useWebSocket } from '@/hooks/useWebSocket'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, ReferenceLine
} from 'recharts'
import { AlertTriangle, Bell, Eye, Users, Activity, Wifi, WifiOff } from 'lucide-react'

interface FeedData {
  frame_b64?: string
  person_count?: number
  density?: number
  incident_type?: string
  severity?: number
  threat_score?: number
  zone?: string
  heatmap_points?: Array<{ lat: number; lng: number; intensity: number }>
  timestamp?: string
}

interface AlertData {
  zone?: string
  type?: string
  severity?: number
  level?: string
  timestamp?: string
  voice_text_en?: string
}

const SEVERITY_COLORS: Record<string, string> = {
  normal: '#10b981',
  crowding: '#f59e0b',
  anomaly: '#ef4444',
  critical: '#8b5cf6',
}

const LEVEL_COLORS: Record<string, string> = {
  log: 'bg-blue-100 text-blue-800',
  municipal: 'bg-amber-100 text-amber-800',
  police: 'bg-red-100 text-red-800',
  emergency: 'bg-purple-100 text-purple-800',
}

export default function Dashboard() {
  const { t } = useTranslation()
  const { data: stats, refetch: refetchStats } = useGetIncidentStats()
  const { data: forecast } = useGetForecast({ zone: 'zone_1' })
  const { data: feedData, isConnected: feedConnected } = useWebSocket('/ws/feed')
  const { data: alertData } = useWebSocket('/ws/alerts')
  const [liveHistory, setLiveHistory] = useState<Array<{ time: string; density: number; count: number }>>([])
  const [recentAlerts, setRecentAlerts] = useState<AlertData[]>([])
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<unknown>(null)
  const heatLayerRef = useRef<unknown>(null)
  const markersRef = useRef<unknown[]>([])

  useEffect(() => {
    const timer = setInterval(() => refetchStats(), 30000)
    return () => clearInterval(timer)
  }, [refetchStats])

  useEffect(() => {
    if (!feedData) return
    const fd = feedData as FeedData
    const now = new Date()
    const label = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLiveHistory((prev) => {
      const next = [...prev, { time: label, density: fd.density ?? 0, count: fd.person_count ?? 0 }]
      return next.slice(-60)
    })
  }, [feedData])

  useEffect(() => {
    if (!alertData) return
    const ad = alertData as AlertData
    setRecentAlerts((prev) => [ad, ...prev].slice(0, 5))
  }, [alertData])

  useEffect(() => {
    if (!mapRef.current) return
    let mounted = true

    Promise.all([
      import('leaflet'),
      import('leaflet/dist/leaflet.css' as string).catch(() => {}),
    ]).then(([L]) => {
      if (!mounted || !mapRef.current) return
      if (leafletMapRef.current) return

      const map = (L as typeof import('leaflet')).map(mapRef.current, {
        center: [17.3850, 78.4867],
        zoom: 13,
        zoomControl: true,
      })
      leafletMapRef.current = map

      ;(L as typeof import('leaflet')).tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map)

      const zones = [
        { name: 'Zone 1', lat: 17.3850, lng: 78.4867 },
        { name: 'Zone 2', lat: 17.3950, lng: 78.4967 },
        { name: 'Zone 3', lat: 17.3750, lng: 78.4767 },
      ]
      zones.forEach((z) => {
        const marker = (L as typeof import('leaflet')).circleMarker([z.lat, z.lng], {
          radius: 10,
          fillColor: '#0F6E56',
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
        }).bindPopup(`<b>${z.name}</b>`).addTo(map)
        markersRef.current.push(marker)
      })
    }).catch(console.error)

    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!feedData || !leafletMapRef.current) return
    const fd = feedData as FeedData
    const points = fd.heatmap_points
    if (!points?.length) return

    import('leaflet').then(async (L) => {
      try {
        const map = leafletMapRef.current as import('leaflet').Map
        if (heatLayerRef.current) {
          map.removeLayer(heatLayerRef.current as import('leaflet').Layer)
        }
        const heatData = points.map((p) => [p.lat, p.lng, p.intensity] as [number, number, number])
        const { HeatLayer } = await import('@/lib/leafletHeat')
        const layer = new HeatLayer(heatData, { radius: 25, blur: 15, maxZoom: 17 })
        layer.addTo(map)
        heatLayerRef.current = layer
      } catch { /* no heat plugin loaded */ }
    }).catch(() => {})
  }, [feedData])

  const fd = feedData as FeedData | null
  const incidentType = fd?.incident_type ?? 'normal'
  const severityColor = SEVERITY_COLORS[incidentType] ?? '#10b981'

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Real-time public safety overview</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {feedConnected ? (
            <span className="flex items-center gap-1.5 text-green-600 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full font-medium">
              <Wifi size={14} />
              Live
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground bg-muted px-3 py-1.5 rounded-full font-medium">
              <WifiOff size={14} />
              Connecting...
            </span>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('dashboard.totalIncidents'), value: stats?.total_today ?? 0, icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50' },
          { label: t('dashboard.activeAlerts'), value: stats?.active_alerts ?? 0, icon: Bell, color: 'text-red-500', bg: 'bg-red-50' },
          { label: t('dashboard.zonesMonitored'), value: stats?.zones_monitored ?? 3, icon: Eye, color: 'text-primary', bg: 'bg-primary/10' },
          { label: t('dashboard.citizensEnrolled'), value: stats?.citizens_enrolled ?? 0, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
                <p className="text-3xl font-bold mt-1 tabular-nums">{value}</p>
              </div>
              <div className={`${bg} ${color} rounded-lg p-2.5`}>
                <Icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Live Activity + Alerts ticker */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-card-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-primary" />
            <h2 className="font-semibold text-sm">{t('dashboard.liveActivity')}</h2>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={liveHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="densityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0F6E56" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0F6E56" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Area type="monotone" dataKey="density" stroke="#0F6E56" strokeWidth={2} fill="url(#densityGrad)" name="Density %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold text-sm mb-4">{t('dashboard.recentAlerts')}</h2>
          <div className="space-y-2">
            {recentAlerts.length === 0 ? (
              <p className="text-muted-foreground text-xs text-center py-8">No recent alerts</p>
            ) : (
              recentAlerts.map((alert, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/50">
                  <div className="shrink-0 w-2 h-2 rounded-full mt-1.5" style={{ backgroundColor: SEVERITY_COLORS[alert.type ?? 'normal'] }} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{alert.zone?.replace('_', ' ').toUpperCase()} — {alert.type}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${LEVEL_COLORS[alert.level ?? 'log']}`}>
                        {alert.level?.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Forecast Chart */}
      {forecast && forecast.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold text-sm mb-4">{t('dashboard.forecast')}</h2>
          <ResponsiveContainer width="100%" height={160}>
            <ComposedChart data={forecast} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="confBand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0F6E56" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0F6E56" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="time_label" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
              />
              <Area type="monotone" dataKey="upper" fill="url(#confBand)" stroke="transparent" name="Upper CI" />
              <Area type="monotone" dataKey="lower" fill="hsl(var(--background))" stroke="transparent" name="Lower CI" />
              <Line type="monotone" dataKey="predicted" stroke="#0F6E56" strokeWidth={2.5} dot={{ r: 4, fill: '#0F6E56' }} name="Predicted Density" />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Density forecast for next 15 minutes · shaded area shows confidence interval
          </p>
        </div>
      )}

      {/* Live Heatmap */}
      <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">Zone Heatmap</h2>
          {fd && (
            <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: `${severityColor}20`, color: severityColor }}>
              {incidentType.toUpperCase()} · {fd.severity ?? 0}%
            </span>
          )}
        </div>
        <div ref={mapRef} className="w-full h-72 rounded-lg overflow-hidden border border-border" />
      </div>
    </div>
  )
}
