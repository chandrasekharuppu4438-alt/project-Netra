import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useListIncidents, useUpdateIncident, getListIncidentsQueryKey } from '@workspace/api-client-react'
import { useQueryClient } from '@tanstack/react-query'
import { Download, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import type { ListIncidentsParams, IncidentUpdate } from '@workspace/api-client-react'

const SEVERITY_BADGE: Record<string, string> = {
  normal: 'bg-green-100 text-green-800',
  crowding: 'bg-amber-100 text-amber-800',
  anomaly: 'bg-red-100 text-red-800',
  critical: 'bg-purple-100 text-purple-800',
}

function getSeverityType(severity: number): string {
  if (severity >= 85) return 'critical'
  if (severity >= 60) return 'anomaly'
  if (severity >= 30) return 'crowding'
  return 'normal'
}

export default function Incidents() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<{
    zone: string; type: string; severityMin: string; severityMax: string; dateFrom: string; dateTo: string
  }>({ zone: '', type: '', severityMin: '', severityMax: '', dateFrom: '', dateTo: '' })

  const params: ListIncidentsParams = {
    page,
    limit: 20,
    ...(filters.zone && { zone: filters.zone }),
    ...(filters.type && { type: filters.type }),
    ...(filters.severityMin && { severity_min: parseInt(filters.severityMin) }),
    ...(filters.severityMax && { severity_max: parseInt(filters.severityMax) }),
    ...(filters.dateFrom && { date_from: filters.dateFrom }),
    ...(filters.dateTo && { date_to: filters.dateTo }),
  }

  const { data, isLoading } = useListIncidents(params)
  const updateMutation = useUpdateIncident()

  const handleUpdate = async (id: string, payload: IncidentUpdate) => {
    await updateMutation.mutateAsync({ id, data: payload })
    queryClient.invalidateQueries({ queryKey: getListIncidentsQueryKey(params) })
  }

  const exportCsv = () => {
    if (!data?.items) return
    const headers = ['ID', 'Zone', 'Type', 'Severity', 'Threat Score', 'Person Count', 'Timestamp', 'SOS', 'Assigned To', 'Status', 'Resolved']
    const rows = data.items.map((i) => [
      i.id, i.zone, i.type, i.severity, i.threat_score, i.person_count,
      i.timestamp, i.sos_triggered ? 'Yes' : 'No', i.assigned_to ?? '', i.status ?? '', i.resolved ? 'Yes' : 'No',
    ])
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'incidents.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('incidents.title')}</h1>
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Download size={14} />
          {t('incidents.exportCsv')}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <select
            value={filters.zone}
            onChange={(e) => { setFilters((f) => ({ ...f, zone: e.target.value })); setPage(1) }}
            className="border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">{t('incidents.zone')}: All</option>
            <option value="zone_1">Zone 1</option>
            <option value="zone_2">Zone 2</option>
            <option value="zone_3">Zone 3</option>
          </select>
          <select
            value={filters.type}
            onChange={(e) => { setFilters((f) => ({ ...f, type: e.target.value })); setPage(1) }}
            className="border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">{t('incidents.type')}: All</option>
            <option value="normal">Normal</option>
            <option value="crowding">Crowding</option>
            <option value="anomaly">Anomaly</option>
            <option value="critical">Critical</option>
          </select>
          <input
            type="number" min={0} max={100} placeholder="Min severity"
            value={filters.severityMin}
            onChange={(e) => { setFilters((f) => ({ ...f, severityMin: e.target.value })); setPage(1) }}
            className="border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="number" min={0} max={100} placeholder="Max severity"
            value={filters.severityMax}
            onChange={(e) => { setFilters((f) => ({ ...f, severityMax: e.target.value })); setPage(1) }}
            className="border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => { setFilters((f) => ({ ...f, dateFrom: e.target.value })); setPage(1) }}
            className="border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => { setFilters((f) => ({ ...f, dateTo: e.target.value })); setPage(1) }}
            className="border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {[t('incidents.zone'), t('incidents.type'), t('incidents.severity'), t('incidents.threatScore'),
                  t('incidents.personCount'), t('incidents.timestamp'), t('incidents.sos'),
                  t('incidents.assignedTo'), t('incidents.status'), t('incidents.actions')
                ].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-muted-foreground text-sm">Loading incidents...</td>
                </tr>
              ) : !data?.items?.length ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-muted-foreground text-sm">{t('incidents.noData')}</td>
                </tr>
              ) : (
                data.items.map((incident) => {
                  const svType = getSeverityType(incident.severity)
                  return (
                    <tr
                      key={incident.id}
                      className={`border-b border-border hover:bg-muted/30 transition-colors ${incident.sos_triggered ? 'border-l-4 border-l-red-500' : ''}`}
                    >
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                        {incident.zone.replace('_', ' ').toUpperCase()}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{incident.type}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${SEVERITY_BADGE[svType]}`}>
                          {incident.severity}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{incident.threat_score}</td>
                      <td className="px-3 py-2.5 tabular-nums">{incident.person_count}</td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                        {new Date(incident.timestamp).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5">
                        {incident.sos_triggered && (
                          <AlertCircle size={16} className="text-red-500" />
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {incident.assigned_to ?? '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          incident.resolved
                            ? 'bg-green-100 text-green-700'
                            : incident.status === 'acknowledged'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {incident.resolved ? 'Resolved' : incident.status ?? 'Open'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {!incident.resolved && incident.status !== 'acknowledged' && (
                            <button
                              onClick={() => handleUpdate(incident.id, { status: 'acknowledged' })}
                              className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200 font-medium whitespace-nowrap transition-colors"
                            >
                              {t('incidents.acknowledge')}
                            </button>
                          )}
                          {!incident.resolved && (
                            <>
                              <select
                                defaultValue=""
                                onChange={(e) => { if (e.target.value) handleUpdate(incident.id, { assigned_to: e.target.value }) }}
                                className="text-xs border border-input rounded px-1.5 py-1 bg-background text-foreground"
                              >
                                <option value="">Assign...</option>
                                <option value="Police">Police</option>
                                <option value="Municipal">Municipal</option>
                                <option value="Fire">Fire</option>
                                <option value="Medical">Medical</option>
                              </select>
                              <button
                                onClick={() => handleUpdate(incident.id, { resolved: true })}
                                className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 font-medium whitespace-nowrap transition-colors"
                              >
                                {t('incidents.resolve')}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Page {data.page} of {data.pages} · {data.total} total
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page === data.pages}
                className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
