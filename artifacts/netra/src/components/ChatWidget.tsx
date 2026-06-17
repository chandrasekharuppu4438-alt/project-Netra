import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { useSendChat } from '@workspace/api-client-react'
import { MessageCircle, X, Send } from 'lucide-react'
import type { ChatInput } from '@workspace/api-client-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_CHIPS = ['chat.chips.report', 'chat.chips.revoke', 'chat.chips.contacts', 'chat.chips.privacy'] as const

export default function ChatWidget() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [lang, setLang] = useState(i18n.language)
  const sendMutation = useSendChat()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sendMutation.isPending])

  const send = async (text: string) => {
    if (!text.trim() || sendMutation.isPending) return
    const userMsg: Message = { role: 'user', content: text.trim() }
    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    setMessages((prev) => [...prev, userMsg])
    setInput('')

    const payload: ChatInput = { message: text.trim(), language: lang, history }
    const result = await sendMutation.mutateAsync({ data: payload })
    setMessages((prev) => [...prev, { role: 'assistant', content: result.reply }])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center hover:opacity-90 transition-all active:scale-95"
        aria-label="Open NETRA Assist chat"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-80 h-[480px] bg-card border border-card-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-3 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle size={14} />
              </div>
              <span className="font-semibold text-sm">{t('chat.title')}</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={lang}
                onChange={(e) => { setLang(e.target.value); i18n.changeLanguage(e.target.value) }}
                className="bg-white/20 text-white text-xs rounded px-1.5 py-0.5 border-0 focus:outline-none"
              >
                <option value="en" className="text-foreground bg-card">EN</option>
                <option value="hi" className="text-foreground bg-card">HI</option>
                <option value="te" className="text-foreground bg-card">TE</option>
              </select>
              <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {/* Welcome */}
            <div className="flex justify-start">
              <div className="max-w-[85%] bg-muted rounded-2xl rounded-tl-sm px-3 py-2 text-sm">
                {t('chat.welcome')}
              </div>
            </div>

            {/* Quick chips */}
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {QUICK_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => send(t(chip))}
                    className="text-xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full hover:bg-primary/20 transition-colors"
                  >
                    {t(chip)}
                  </button>
                ))}
              </div>
            )}

            {/* Message thread */}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-muted rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {sendMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-muted-foreground typing-dot"
                      style={{ animationDelay: `${i * 0.2}s` }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-3 border-t border-border shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('chat.placeholder')}
              disabled={sendMutation.isPending}
              className="flex-1 bg-muted rounded-full px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || sendMutation.isPending}
              className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
