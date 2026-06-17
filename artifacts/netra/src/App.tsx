import { useState } from 'react'
import { Switch, Route, Router as WouterRouter, Link, useLocation } from 'wouter'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import {
  LayoutDashboard,
  Video,
  AlertTriangle,
  ShieldCheck,
  Leaf,
  AlertCircle,
  Menu,
  X,
  Globe,
} from 'lucide-react'
import Dashboard from '@/pages/Dashboard'
import LiveFeed from '@/pages/LiveFeed'
import Incidents from '@/pages/Incidents'
import ConsentPortal from '@/pages/ConsentPortal'
import Environment from '@/pages/Environment'
import SOS from '@/pages/SOS'
import MobileCam from '@/pages/MobileCam'
import ChatWidget from '@/components/ChatWidget'
import VoiceAlert from '@/components/VoiceAlert'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'HI' },
  { code: 'te', label: 'TE' },
]

function NavItem({ href, icon: Icon, label, onClick }: { href: string; icon: React.ElementType; label: string; onClick?: () => void }) {
  const [location] = useLocation()
  const active = location === href || (href !== '/' && location.startsWith(href))
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
      }`}
    >
      <Icon size={18} className="shrink-0" />
      <span>{label}</span>
    </Link>
  )
}

function Sidebar({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation()
  const [lang, setLang] = useState(i18n.language)

  const changeLang = (code: string) => {
    i18n.changeLanguage(code)
    setLang(code)
  }

  const navItems = [
    { href: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { href: '/feed', icon: Video, label: t('nav.liveFeed') },
    { href: '/incidents', icon: AlertTriangle, label: t('nav.incidents') },
    { href: '/consent', icon: ShieldCheck, label: t('nav.consent') },
    { href: '/environment', icon: Leaf, label: t('nav.environment') },
    { href: '/sos', icon: AlertCircle, label: t('nav.sos') },
  ]

  return (
    <aside className="flex flex-col h-full bg-sidebar text-sidebar-foreground w-64 shrink-0">
      <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <ShieldCheck size={18} className="text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight text-sidebar-foreground">NETRA</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-sidebar-foreground/60 hover:text-sidebar-foreground lg:hidden">
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavItem key={item.href} {...item} onClick={onClose} />
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-1.5 mb-1">
          <Globe size={13} className="text-sidebar-foreground/50" />
          <span className="text-xs text-sidebar-foreground/50 uppercase tracking-wider">Language</span>
        </div>
        <div className="flex gap-1 mt-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => changeLang(l.code)}
              className={`flex-1 py-1.5 rounded text-xs font-semibold transition-all ${
                lang === l.code
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-sidebar-accent/40 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="bg-sidebar-accent/30 rounded-lg px-3 py-2">
          <p className="text-xs text-sidebar-foreground/50 leading-relaxed">
            Citizen-consented AI surveillance. Privacy-first public safety.
          </p>
        </div>
      </div>
    </aside>
  )
}

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 h-full">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setSidebarOpen(true)} className="text-foreground/70 hover:text-foreground">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary" />
            <span className="font-bold text-lg tracking-tight">NETRA</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/feed" component={LiveFeed} />
            <Route path="/incidents" component={Incidents} />
            <Route path="/consent" component={ConsentPortal} />
            <Route path="/environment" component={Environment} />
            <Route path="/sos" component={SOS} />
          </Switch>
        </main>
      </div>

      <ChatWidget />
      <VoiceAlert />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Switch>
          <Route path="/mobile-cam" component={MobileCam} />
          <Route component={Layout} />
        </Switch>
      </WouterRouter>
    </QueryClientProvider>
  )
}
