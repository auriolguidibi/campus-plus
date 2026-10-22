import { useCallback, useEffect, useState } from 'react'
import Icon from '../components/Icon'
import { api, ApiError, type Page } from '../api'
import { useAuth } from '../auth'
import { ErrorBox, Spinner, timeAgo } from '../components/ui'

interface Confession { id: number; text: string; created_at: string; reaction_count: number; comment_count: number; reacted: boolean }
interface Mine { id: number; text: string; status: string; reject_reason: string; created_at: string }
interface Cm { id: number; label: string; text: string; created_at: string }
interface Queued { id: number; text: string; status: string; reports: number }

const STATUS: Record<string, string> = { pending: 'En attente de modération', published: 'Publiée', rejected: 'Refusée', flagged: 'Masquée (signalements)', removed: 'Supprimée' }
const RULES = "Interdits : menaces, harcèlement, accusations visant une personne identifiable, coordonnées et informations personnelles, contenus dangereux. Ton identité n'est jamais affichée ; elle n'est conservée que pour traiter les abus."

function Card({ c, onChange }: { c: Confession; onChange: (c: Confession) => void }) {
  const [open, setOpen] = useState(false)
  const [cms, setCms] = useState<Cm[] | null>(null)
  const [text, setText] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => { if (open && cms === null) api<Cm[]>(`/confessions/${c.id}/comments/`).then(setCms) }, [open, cms, c.id])

  async function react() {
    const { active } = await api<{ active: boolean }>(`/confessions/${c.id}/react/`, { method: 'POST' })
    onChange({ ...c, reacted: active, reaction_count: c.reaction_count + (active ? 1 : -1) })
  }
  async function comment() {
    try { const l = await api<Cm[]>(`/confessions/${c.id}/comments/`, { body: { text } }); setCms(l); setText(''); setMsg(''); onChange({ ...c, comment_count: l.length }) }
    catch (x) { setMsg(x instanceof ApiError ? x.text : 'Erreur') }
  }
  async function report() {
    const reason = prompt('Pourquoi signales-tu cette confession ?') ?? ''
    const r = await api<{ detail: string }>(`/confessions/${c.id}/report/`, { body: { reason } })
    setMsg(r.detail)
  }

  return (
    <article className="card p-4">
      <p className="whitespace-pre-wrap break-words text-sm">{c.text}</p>
      <p className="mt-2 text-xs text-muted">Anonyme · {timeAgo(c.created_at)}</p>
      <footer className="mt-2 flex items-center gap-5 text-sm text-muted">
        <button onClick={react} className={`flex items-center gap-1.5 ${c.reacted ? 'font-semibold text-danger' : ''}`}><Icon name="heart" bold={c.reacted} size={20} /> {c.reaction_count}</button>
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5"><Icon name="chatLine" size={20} /> {c.comment_count}</button>
        <button onClick={report} className="ml-auto text-xs">Signaler</button>
      </footer>
      {msg && <p className="mt-2 text-xs text-muted" role="status">{msg}</p>}
      {open && (
        <div className="mt-3 space-y-2 border-t border-line pt-2">
          {cms === null ? <Spinner /> : cms.map((m) => <p key={m.id} className="rounded-xl bg-soft px-3 py-2 text-sm"><b>{m.label}</b> {m.text}</p>)}
          <div className="flex gap-2">
            <input className="field !py-2" placeholder="Commentaire anonyme…" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
            <button className="rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg" onClick={comment} disabled={!text.trim()}>Envoyer</button>
          </div>
        </div>
      )}
    </article>
  )
}

export default function Confessions() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'feed' | 'mine' | 'mod'>('feed')
  const [items, setItems] = useState<Confession[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [mine, setMine] = useState<Mine[]>([])
  const [queue, setQueue] = useState<Queued[]>([])
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  const load = useCallback(async (path: string, reset: boolean) => {
    setLoading(true)
    try {
      const p = await api<Page<Confession>>(path)
      setItems((old) => (reset ? p.results : [...old, ...p.results.filter((x) => !old.some((o) => o.id === x.id))]))
      setNext(p.next ? p.next.replace(/^.*\/api/, '') : null)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (tab === 'feed') load('/confessions/', true) }, [tab, load])
  useEffect(() => { if (tab === 'mine') api<Mine[]>('/confessions/mine/').then(setMine) }, [tab])
  useEffect(() => { if (tab === 'mod') api<Queued[]>('/confessions/queue/').then(setQueue) }, [tab])

  async function submit() {
    setErr(''); setOk('')
    try {
      const r = await api<{ status: string }>('/confessions/', { body: { text } })
      setText(''); setOk(r.status === 'pending' ? 'Envoyée : elle sera publiée après modération.' : 'Publiée !')
    } catch (x) { setErr(x instanceof ApiError ? (x.data?.detail ?? x.text) : 'Serveur injoignable.') }
  }
  async function moderate(id: number, decision: string) {
    const reason = decision === 'approve' ? '' : prompt('Motif (visible par son auteur)') ?? ''
    await api(`/confessions/queue/${id}/`, { body: { decision, reason } })
    setQueue(queue.filter((q) => q.id !== id))
  }

  const tabs: [typeof tab, string][] = [['feed', 'Confessions'], ['mine', 'Mes envois'], ...(user?.is_staff ? [['mod', 'Modération'] as [typeof tab, string]] : [])]
  return (
    <div className="space-y-4 pt-6">
      <h1 className="text-2xl font-bold">Confessions anonymes</h1>
      <details className="card p-3 text-sm"><summary className="cursor-pointer font-semibold">Règles</summary><p className="mt-2 text-muted">{RULES}</p></details>
      <section className="space-y-2">
        <textarea className="field min-h-24" maxLength={1000} placeholder="Confie-toi anonymement… (20 caractères min.)" value={text} onChange={(e) => setText(e.target.value)} />
        <ErrorBox>{err}</ErrorBox>
        {ok && <p className="text-sm text-accent" role="status">{ok}</p>}
        <button className="btn" onClick={submit} disabled={text.trim().length < 20}>Publier anonymement</button>
      </section>
      <div className="flex gap-2" role="tablist">
        {tabs.map(([v, l]) => <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === v ? 'bg-primary text-primary-fg' : 'bg-soft text-muted'}`}>{l}</button>)}
      </div>
      {tab === 'feed' && (
        <>
          <div className="space-y-3">{items.map((c) => <Card key={c.id} c={c} onChange={(n) => setItems(items.map((x) => (x.id === n.id ? n : x)))} />)}</div>
          {loading && <Spinner />}
          {!loading && items.length === 0 && <p className="py-6 text-center text-sm text-muted">Aucune confession publiée.</p>}
          {next && !loading && <button className="btn-outline" onClick={() => load(next, false)}>Voir plus</button>}
        </>
      )}
      {tab === 'mine' && (mine.length === 0 ? <p className="py-6 text-center text-sm text-muted">Rien envoyé pour le moment. Seul toi vois cette liste.</p> : mine.map((m) => (
        <div key={m.id} className="card p-3 text-sm"><p className="whitespace-pre-wrap">{m.text}</p><p className="mt-1 text-xs text-muted">{STATUS[m.status]}{m.reject_reason && ` — ${m.reject_reason}`}</p></div>
      )))}
      {tab === 'mod' && (queue.length === 0 ? <p className="py-6 text-center text-sm text-muted">File de modération vide. (L'auteur n'est jamais affiché.)</p> : queue.map((q) => (
        <div key={q.id} className="card space-y-2 p-3 text-sm">
          <p className="whitespace-pre-wrap">{q.text}</p>
          <p className="text-xs text-muted">{STATUS[q.status]} · {q.reports} signalement{q.reports > 1 ? 's' : ''}</p>
          <div className="flex gap-2">
            <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg" onClick={() => moderate(q.id, 'approve')}>Publier</button>
            <button className="rounded-lg border border-line px-3 py-1.5 text-xs" onClick={() => moderate(q.id, 'reject')}>Refuser</button>
            <button className="rounded-lg border border-line px-3 py-1.5 text-xs text-danger" onClick={() => moderate(q.id, 'remove')}>Supprimer</button>
          </div>
        </div>
      )))}
    </div>
  )
}
