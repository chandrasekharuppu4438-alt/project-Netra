import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRegisterConsent, useRevokeConsent } from '@workspace/api-client-react'
import { ShieldCheck, CheckCircle, ChevronDown, ChevronUp, Star } from 'lucide-react'
import type { ConsentInput, ConsentRecord } from '@workspace/api-client-react'

const PRIVACY_ITEMS = [
  { icon: '🕵️', label: 'What we collect', content: 'Zone-level movement density patterns only. No personal identity data, no GPS tracking of individuals, no biometric storage. Faces are blurred in real-time before any processing.' },
  { icon: '👮', label: 'Who can access', content: 'Law enforcement agencies receive only aggregated zone alerts (severity level + zone name). No individual tracking data is shared. All access is logged and auditable.' },
  { icon: '⚖️', label: 'Your rights', content: 'You can revoke consent at any time. Upon revocation, all data associated with your registration is immediately deleted. You have the right to request a copy of your data under DPDP Act 2023.' },
]

export default function ConsentPortal() {
  const { t } = useTranslation()
  const [form, setForm] = useState<ConsentInput>({ citizen_name: '', phone: '', zone: 'zone_1', language: 'en' })
  const [consentRecord, setConsentRecord] = useState<ConsentRecord | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [revokeSuccess, setRevokeSuccess] = useState(false)
  const registerMutation = useRegisterConsent()
  const revokeMutation = useRevokeConsent()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await registerMutation.mutateAsync({ data: form })
    setConsentRecord(result)
    setRevokeSuccess(false)
  }

  const handleRevoke = async () => {
    if (!consentRecord) return
    await revokeMutation.mutateAsync({ id: consentRecord.id })
    setConsentRecord(null)
    setRevokeSuccess(true)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('consent.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Exercise your right to contribute to public safety while maintaining full data sovereignty.
        </p>
      </div>

      {revokeSuccess && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
          <CheckCircle size={20} className="text-green-600 shrink-0" />
          <p className="text-green-800 font-medium">{t('consent.revokeSuccess')} — Your data has been permanently deleted.</p>
        </div>
      )}

      {/* Registration Form or Consent Card */}
      {!consentRecord ? (
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t('consent.register')}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('consent.name')}</label>
                <input
                  required
                  type="text"
                  placeholder="Rajesh Kumar"
                  value={form.citizen_name}
                  onChange={(e) => setForm((f) => ({ ...f, citizen_name: e.target.value }))}
                  className="w-full border border-input rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('consent.phone')}</label>
                <input
                  required
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-input rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('consent.zone')}</label>
                <select
                  value={form.zone}
                  onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
                  className="w-full border border-input rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="zone_1">Zone 1 — Hyderabad Central</option>
                  <option value="zone_2">Zone 2 — Secunderabad</option>
                  <option value="zone_3">Zone 3 — Banjara Hills</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('consent.language')}</label>
                <select
                  value={form.language}
                  onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                  className="w-full border border-input rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="en">English</option>
                  <option value="hi">हिंदी</option>
                  <option value="te">తెలుగు</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {registerMutation.isPending ? 'Registering...' : t('consent.submit')}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <h2 className="font-semibold text-green-700">{t('consent.active')}</h2>
            </div>
            <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
              ID: {consentRecord.id.slice(-8).toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Name</span>
              <p className="font-medium">{consentRecord.citizen_name}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Zone</span>
              <p className="font-medium">{consentRecord.zone.replace('_', ' ').toUpperCase()}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Data Usage</span>
              <p className="font-medium text-xs">{t('consent.dataUsage')}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Retention</span>
              <p className="font-medium text-xs">{t('consent.retention')}</p>
            </div>
          </div>

          <button
            onClick={handleRevoke}
            disabled={revokeMutation.isPending}
            className="w-full bg-destructive/10 text-destructive border border-destructive/20 py-2.5 rounded-lg font-semibold hover:bg-destructive/20 disabled:opacity-60 transition-colors"
          >
            {revokeMutation.isPending ? 'Revoking...' : t('consent.revoke')}
          </button>
        </div>
      )}

      {/* Privacy Grade Card */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={20} className="text-primary" />
            <h2 className="font-semibold">{t('consent.privacyGrade')}</h2>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-3xl font-black text-primary">A+</span>
            {[...Array(5)].map((_, i) => <Star key={i} size={14} className="text-amber-400 fill-amber-400" />)}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            'Face anonymisation',
            'Informed consent required',
            'Audit trail logged',
            'Data minimisation principle',
            'Right to revoke anytime',
            'DPDP Act 2023 compliant',
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm">
              <CheckCircle size={14} className="text-primary shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Privacy Accordion */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden shadow-sm">
        {PRIVACY_ITEMS.map((item, i) => (
          <div key={i} className={i > 0 ? 'border-t border-border' : ''}>
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors text-left"
            >
              <span className="font-medium text-sm flex items-center gap-2.5">
                <span>{item.icon}</span>
                {item.label}
              </span>
              {expanded === i ? <ChevronUp size={16} className="text-muted-foreground shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
            </button>
            {expanded === i && (
              <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                {item.content}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
