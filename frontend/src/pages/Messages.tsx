import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError, type ChatMessage, type ConversationSummary } from '../api'
import { useAuth } from '../auth'
import { useCalls } from '../calls'
import Icon from '../components/Icon'
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
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-soft px-3.5 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
        <Icon name="search" size={20} className="text-muted" />
        <input className="min-w-0 flex-1 bg-transparent py-3.5 text-sm outline-none placeholder:text-muted/70" placeholder="Rechercher une conversation…" aria-label="Rechercher une conversation" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {items === null ? <Spinner /> : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Aucune conversation. Contacte un vendeur depuis la Marketplace.</p>
      ) : (
        <div className="card divide-y divide-line px-3">
          {items.map((c) => (
            <Link key={c.id} to={`/messages/${c.id}`} className="flex items-center gap-3 py-3">
              <Avatar user={c.other} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.other.first_name} {c.other.last_name}{c.listing && <span className="font-normal text-muted"> · {c.listing.title}</span>}</p>
                <p className={`flex items-center gap-1 truncate text-sm ${c.unread ? 'font-semibold' : 'text-muted'}`}>
                  {c.last_message?.kind === 'voice' && <Icon name="mic" size={14} />}{c.last_message?.text ?? 'Nouvelle conversation'}
                </p>
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

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function VoiceBubble({ m, mine }: { m: ChatMessage; mine: boolean }) {
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const total = m.audio_seconds ?? 0
  function toggle() {
    const a = audio.current
    if (!a) return
    if (playing) a.pause(); else a.play().catch(() => {})
  }
  return (
    <div className={`flex w-56 items-center gap-3 rounded-2xl px-3 py-2.5 ${mine ? 'bg-primary text-primary-fg' : 'bg-soft'}`}>
      <button onClick={toggle} aria-label={playing ? 'Pause' : 'Écouter la note vocale'} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${mine ? 'bg-white/20' : 'bg-primary text-primary-fg'}`}>
        <Icon name={playing ? 'pause' : 'play'} bold size={18} />
      </button>
      <div className="min-w-0 flex-1">
        <div className={`h-1.5 overflow-hidden rounded-full ${mine ? 'bg-white/30' : 'bg-line'}`}><div className={`h-full ${mine ? 'bg-white' : 'bg-primary'}`} style={{ width: `${total ? Math.min(100, (pos / total) * 100) : 0}%` }} /></div>
        <p className="mt-1 text-[11px] opacity-80">{playing ? `${mmss(pos)} / ` : ''}{mmss(total)}</p>
      </div>
      <audio ref={audio} src={m.audio_url ?? undefined} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setPos(0) }} onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)} />
    </div>
  )
}

/** Tap the mic, speak, tap send (or the bin to cancel). 120 s max, enforced again by the server. */
function Recorder({ onSend, onCancel }: { onSend: (blob: Blob, seconds: number) => void; onCancel: () => void }) {
  const [secs, setSecs] = useState(0)
  const [err, setErr] = useState('')
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const start = useRef(0)
  const stream = useRef<MediaStream | null>(null)
  const send = useRef(true)

  useEffect(() => {
    let timer = 0
    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Enregistrement non pris en charge (HTTPS requis).')
        const s = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.current = s
        const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t))
        const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined)
        rec.current = r
        r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data) }
        r.onstop = () => {
          stream.current?.getTracks().forEach((t) => t.stop())
          const seconds = Math.max(1, Math.round((Date.now() - start.current) / 1000))
          if (send.current && chunks.current.length) onSend(new Blob(chunks.current, { type: r.mimeType }), seconds); else onCancel()
        }
        start.current = Date.now(); r.start()
        timer = window.setInterval(() => { const n = Math.floor((Date.now() - start.current) / 1000); setSecs(n); if (n >= 120) r.stop() }, 250)
      } catch (x) { setErr(x instanceof Error && x.message.includes('HTTPS') ? x.message : 'Micro indisponible ou autorisation refusée.') }
    })()
    return () => { window.clearInterval(timer); stream.current?.getTracks().forEach((t) => t.stop()) }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <div className="flex items-center justify-between rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger"><span>{err}</span><button onClick={onCancel} className="font-semibold">OK</button></div>
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-danger bg-danger/5 px-3 py-2" role="status" aria-label="Enregistrement en cours">
      <button type="button" onClick={() => { send.current = false; rec.current?.stop() }} aria-label="Annuler l'enregistrement" className="text-danger"><Icon name="trash" size={22} /></button>
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" aria-hidden />
      <span className="flex-1 text-sm font-semibold tabular-nums">{mmss(secs)}</span>
      <button type="button" onClick={() => { send.current = true; rec.current?.stop() }} aria-label="Envoyer la note vocale" className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-fg"><Icon name="send" bold size={20} /></button>
    </div>
  )
}

export function Thread() {
  const { id } = useParams()
  const { user } = useAuth()
  const calls = useCalls()
  const [conv, setConv] = useState<ConversationSummary | null>(null)
  const [msgs, setMsgs] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [recording, setRecording] = useState(false)
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
  async function sendVoice(blob: Blob, seconds: number) {
    setRecording(false)
    const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
    const fd = new FormData(); fd.append('audio', blob, `note.${ext}`); fd.append('seconds', String(seconds))
    try { await api(`/conversations/${id}/messages/`, { body: fd }); poll() }
    catch (x) { setErr(x instanceof ApiError ? (x.data?.audio ?? x.data?.detail ?? x.text) : 'Envoi impossible.') }
  }
  async function call(kind: 'audio' | 'video') { setErr((await calls.start(Number(id), kind)) ?? '') }

  if (missing) return <p className="pt-10 text-center text-muted">Conversation introuvable.</p>
  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col pt-4">
      <header className="mb-3 flex items-center gap-3 border-b border-line pb-3">
        <Link to="/messages" aria-label="Retour" className="text-link"><Icon name="back" size={24} /></Link>
        {conv && <><Avatar user={conv.other} size={36} />
          <div className="min-w-0 flex-1"><Link to={`/u/${conv.other.username}`} className="block truncate font-semibold">{conv.other.first_name} {conv.other.last_name}</Link>
            {conv.listing && <Link to={`/marketplace/${conv.listing.id}`} className="flex items-center gap-1 truncate text-xs text-link"><Icon name="shop" size={14} /> {conv.listing.title}</Link>}</div>
          <button onClick={() => call('audio')} disabled={calls.busy} aria-label="Appel audio" className="grid h-10 w-10 place-items-center rounded-full bg-soft text-link disabled:opacity-40"><Icon name="phone" size={20} /></button>
          <button onClick={() => call('video')} disabled={calls.busy} aria-label="Appel vidéo" className="grid h-10 w-10 place-items-center rounded-full bg-soft text-link disabled:opacity-40"><Icon name="video" size={20} /></button></>}
      </header>
      <div className="flex-1 space-y-2">
        {msgs.map((m) => m.kind === 'system' ? (
          <p key={m.id} className="mx-auto w-fit max-w-[90%] rounded-xl bg-soft px-3 py-1.5 text-center text-xs text-muted">{m.text}</p>
        ) : (
          <div key={m.id} className={`flex ${m.sender === user?.id ? 'justify-end' : ''}`}>
            {m.kind === 'voice' ? <VoiceBubble m={m} mine={m.sender === user?.id} /> : (
              <p className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${m.sender === user?.id ? 'bg-primary text-primary-fg' : 'bg-soft'}`}>
                {m.text}<span className="mt-0.5 block text-right text-[10px] opacity-70">{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
              </p>
            )}
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <ErrorBox>{err}</ErrorBox>
      <div className="sticky bottom-20 mt-3 bg-bg py-2">
        {recording ? <Recorder onSend={sendVoice} onCancel={() => setRecording(false)} /> : (
          <form onSubmit={send} className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-2xl border border-line bg-soft px-3.5 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
              <input className="min-w-0 flex-1 bg-transparent py-3.5 text-sm outline-none placeholder:text-muted/70" value={text} onChange={(e) => setText(e.target.value)} placeholder="Écrire un message…" aria-label="Message" maxLength={2000} />
            </div>
            {text.trim()
              ? <button aria-label="Envoyer" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-fg shadow-md shadow-primary/30"><Icon name="send" bold size={22} /></button>
              : <button type="button" onClick={() => { setErr(''); setRecording(true) }} aria-label="Enregistrer une note vocale" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-fg shadow-md shadow-primary/30"><Icon name="mic" bold size={22} /></button>}
          </form>
        )}
      </div>
    </div>
  )
}
