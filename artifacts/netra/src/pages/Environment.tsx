import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGetAQI } from '@workspace/api-client-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Leaf, Wind, TrendingDown } from 'lucide-react'

const AQI_CONFIG: Record<string, { color: string; bg: string; border: string; bar: string }> = {
  Good: { color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', bar: '#10b981' },
  Moderate: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', bar: '#f59e0b' },
  Unhealthy: { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', bar: '#f97316' },
  Hazardous: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', bar: '#ef4444' },
}

function generateCo2History(baseKg: number) {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, '0')}:00`,
    co2: parseFloat((baseKg * (i + 1) / 24 + Math.random() * 2).toFixed(2)),
  }))
}

function generateRouteEvents() {
  const zones = ['Zone 1', 'Zone 2', 'Zone 3']
  return Array.from({ length: 6 }, (_, i) => ({
    id: i,
    zone: zones[i % 3],
    vehicles: Math.floor(Math.random() * 50 + 15),
    minutes: Math.floor(Math.random() * 8 + 2),
    co2: parseFloat((Math.random() * 3 + 0.5).toFixed(2)),
    time: new Date(Date.now() - i * 1800000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }))
}

export default function Environment() {
  const { t } = useTranslation()
  const { data: aqiData } = useGetAQI()
  const [co2Display, setCo2Display] = useState<number>(0)
  const co2Target = useRef(aqiData?.co2_kg ?? 0)
  const co2History = useRef(generateCo2History(aqiData?.co2_kg ?? 45))
  const routeEvents = useRef(generateRouteEvents())

  useEffect(() => {
    if (aqiData?.co2_kg) {
      co2Target.current = aqiData.co2_kg
      setCo2Display(aqiData.co2_kg)
    }
  }, [aqiData])

  useEffect(() => {
    const timer = setInterval(() => {
      setCo2Display((prev) => {
        const delta = 0.003
        return parseFloat((prev + delta).toFixed(3))
      })
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('environment.title')}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{t('environment.tagline')}</p>
      </div>

      {/* CO2 Hero */}
      <div className="bg-gradient-to-br from-primary/90 to-primary rounded-2xl p-6 text-primary-foreground shadow-lg">
        <div className="flex items-center gap-2 mb-2 opacity-90">
          <Leaf size={18} />
          <span className="text-sm font-medium uppercase tracking-wide">Carbon Impact Today</span>
        </div>
        <div className="flex items-end gap-3">
          <span className="text-6xl font-black tabular-nums leading-none">{co2Display.toFixed(3)}</span>
          <span className="text-xl font-semibold pb-1 opacity-80">{t('environment.co2Saved')}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-3 opacity-80 text-sm">
          <TrendingDown size={14} />
          <span>{aqiData?.events_count ?? 0} traffic reroute events contributing to reduction</span>
        </div>
      </div>

      {/* AQI Cards */}
      <div>
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Wind size={16} className="text-primary" />
          {t('environment.aqi')} by Zone
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(aqiData?.zones ?? []).map((zone) => {
            const cfg = AQI_CONFIG[zone.category] ?? AQI_CONFIG.Moderate
            const pct = Math.min(100, (zone.aqi / 200) * 100)
            return (
              <div key={zone.zone} className={`${cfg.bg} ${cfg.border} border rounded-xl p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-sm text-foreground">{zone.zone.replace('_', ' ').toUpperCase()}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-white/60 ${cfg.color}`}>
                    {zone.category}
                  </span>
                </div>
                <p className={`text-4xl font-black tabular-nums ${cfg.color}`}>{zone.aqi}</p>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">AQI Index</p>
                <div className="w-full h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cfg.bar }} />
                </div>
              </div>
            )
          })}
          {(!aqiData?.zones || aqiData.zones.length === 0) &&
            ['Zone 1', 'Zone 2', 'Zone 3'].map((z) => (
              <div key={z} className="bg-muted border border-border rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-muted-foreground/20 rounded mb-3 w-24" />
                <div className="h-10 bg-muted-foreground/20 rounded w-16" />
              </div>
            ))
          }
        </div>
      </div>

      {/* CO2 Chart */}
      <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
        <h2 className="font-semibold text-sm mb-4">Cumulative CO₂ Reduction (Last 24 hours)</h2>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={co2History.current} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="co2Grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickLine={false} interval={3} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => [`${v} kg`, 'CO₂ Prevented']}
            />
            <Area type="monotone" dataKey="co2" stroke="#10b981" strokeWidth={2} fill="url(#co2Grad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Traffic Reroute Events */}
      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-sm">{t('environment.trafficReroutes')}</h2>
        </div>
        <div className="divide-y divide-border">
          {routeEvents.current.map((event) => (
            <div key={event.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <div>
                  <p className="text-sm font-medium">{event.zone}</p>
                  <p className="text-xs text-muted-foreground">{event.time}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-right">
                <div>
                  <p className="font-semibold">{event.vehicles}</p>
                  <p className="text-xs text-muted-foreground">vehicles</p>
                </div>
                <div>
                  <p className="font-semibold">{event.minutes} min</p>
                  <p className="text-xs text-muted-foreground">saved</p>
                </div>
                <div>
                  <p className="font-semibold text-green-600">{event.co2} kg</p>
                  <p className="text-xs text-muted-foreground">CO₂</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
