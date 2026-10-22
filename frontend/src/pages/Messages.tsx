import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError, type ChatMessage, type ConversationSummary } from '../api'
import { useAuth } from '../auth'
import { Avatar, ErrorBox, Spinner, timeAgo } from '../components/ui'

export function Conversations() {
  const [items, setItems] = useState<ConversationSummary[] | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    const load = () => api<ConversationSummary[]>(`/conversations/?q=${encodeURIComponent(q.trim())}`).then(setItems).catch(() => setItems([]))
    const t = setTimeout(load, 200)
    const poll = setInterval(load, 10000)
    return () => { clearTimeout(t); clearInterval(poll) }
  }, [q])

  return (
    <div className="space-y-4 pt-6">
      <h1 className="text-2xl font-bold">Messages</h1>
      <input className="field" placeholder="Rechercher une conversation…" value={q} onChange={(e) => setQ(e.target.value)} />
      {items === null ? <Spinner /> : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Aucune conversation. Contacte un vendeur depuis la Marketplace.</p>
      ) : (
        <div className="card divide-y divide-line px-3">
          {items.map((c) => (
            <Link key={c.id} to={`/messages/${c.id}`} className="flex items-center gap-3 py-3">
              <Avatar user={c.other} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.other.first_name} {c.other.last_name}{c.listing && <span className="font-normal text-muted"> · {c.listing.title}</span>}</p>
                <p className={`truncate text-sm ${c.unread ? 'font-semibold' : 'text-muted'}`}>{c.last_message?.text ?? 'Nouvelle conversation'}</p>
              </div>
              <div className="text-right text-xs text-muted">
                {c.last_message && timeAgo(c.last_message.created_at)}
                {c.unread > 0 && <span className="mt-1 block rounded-full bg-primary px-1.5 py-0.5 font-bold text-primary-fg">{c.unread}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function Thread() {
  const { id } = useParams()
  const { user } = useAuth()
  const [conv, setConv] = useState<ConversationSummary | null>(null)
  const [msgs, setMsgs] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [missing, setMissing] = useState(false)
  const last = useRef(0)
  const bottom = useRef<HTMLDivElement>(null)

  // Polling (no WebSocket yet): fetch only messages newer than the last one we have.
  const poll = useCallback(async () => {
    try {
      const r = await api<{ conversation: ConversationSummary; messages: ChatMessage[] }>(`/conversations/${id}/messages/?after=${last.current}`)
      setConv(r.conversation)
      if (r.messages.length) {
        last.current = r.messages[r.messages.length - 1].id
        setMsgs((old) => [...old, ...r.messages.filter((m) => !old.some((o) => o.id === m.id))])
      }
    } catch (x) { if (x instanceof ApiError && x.status === 404) setMissing(true) }
  }, [id])

  useEffect(() => { last.current = 0; setMsgs([]); poll(); const t = setInterval(poll, 4000); return () => clearInterval(t) }, [poll])
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }) }, [msgs.length])

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    try { await api(`/conversations/${id}/messages/`, { body: { text } }); setText(''); poll() }
    catch (x) { setErr(x instanceof ApiError ? (x.data?.detail ?? x.text) : 'Envoi impossible.') }
  }

  if (missing) return <p className="pt-10 text-center text-muted">Conversation introuvable.</p>
  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col pt-4">
      <header className="mb-3 flex items-center gap-3 border-b border-line pb-3">
        <Link to="/messages" aria-label="Retour" className="text-primary">←</Link>
        {conv && <><Avatar user={conv.other} size={36} />
          <div className="min-w-0 flex-1"><Link to={`/u/${conv.other.username}`} className="block truncate font-semibold">{conv.other.first_name} {conv.other.last_name}</Link>
            {conv.listing && <Link to={`/marketplace/${conv.listing.id}`} className="block truncate text-xs text-primary">🛍️ {conv.listing.title}</Link>}</div></>}
      </header>
      <div className="flex-1 space-y-2">
        {msgs.map((m) => m.is_system ? (
          <p key={m.id} className="mx-auto w-fit max-w-[90%] rounded-xl bg-soft px-3 py-1.5 text-center text-xs text-muted">{m.text}</p>
        ) : (
          <div key={m.id} className={`flex ${m.sender === user?.id ? 'justify-end' : ''}`}>
            <p className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${m.sender === user?.id ? 'bg-primary text-primary-fg' : 'bg-soft'}`}>
              {m.text}<span className="mt-0.5 block text-right text-[10px] opacity-70">{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
            </p>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <ErrorBox>{err}</ErrorBox>
      <form onSubmit={send} className="sticky bottom-20 mt-3 flex gap-2 bg-bg py-2">
        <input className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="Écrire un message…" maxLength={2000} />
        <button className="rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg">Envoyer</button>
      </form>
    </div>
  )
}
