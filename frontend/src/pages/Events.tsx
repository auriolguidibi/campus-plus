import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, type CampusEvent, type Page } from '../api'
import { useAuth } from '../auth'
import { ErrorBox, Spinner } from '../components/ui'

const CATS: Record<string, string> = { soiree: 'Soirée étudiante', hackathon: 'Hackathon', conference: 'Conférence', soutenance: 'Soutenance', tournoi: 'Tournoi', club: 'Rencontre de club', association: 'Activité associative' }
const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

export function Events() {
  const [tab, setTab] = useState<'upcoming' | 'past' | 'reminders'>('upcoming')
  const [items, setItems] = useState<CampusEvent[] | null>(null)
  useEffect(() => {
    setItems(null)
    const q = tab === 'past' ? 'when=past' : tab === 'reminders' ? 'scope=reminders' : ''
    api<Page<CampusEvent>>(`/events/?${q}`).then((p) => setItems(p.results)).catch(() => setItems([]))
  }, [tab])
  return (
    <div className="space-y-4 pt-6">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Événements</h1><Link to="/evenements/nouveau" className="text-sm font-semibold text-primary">+ Organiser</Link></div>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-soft p-1" role="tablist">
        {([['upcoming', 'À venir'], ['reminders', 'Mes rappels'], ['past', 'Archives']] as const).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={`rounded-lg py-2 text-xs font-semibold ${tab === v ? 'bg-primary text-primary-fg' : 'text-muted'}`}>{l}</button>
        ))}
      </div>
      {items === null ? <Spinner /> : items.length === 0 ? <p className="py-8 text-center text-sm text-muted">Aucun événement.</p> : (
        <div className="space-y-3">
          {items.map((e) => (
            <Link key={e.id} to={`/evenements/${e.id}`} className="card block overflow-hidden">
              {e.image && <img src={e.image} alt="" loading="lazy" className="h-32 w-full object-cover" />}
              <div className="p-4"><p className="text-xs text-primary">{CATS[e.category]}</p><p className="font-semibold">{e.title}</p>
                <p className="text-xs text-muted">{when(e.starts_at)} · {e.location}</p>
                <p className="mt-1 text-xs text-muted">{e.going_count} participant{e.going_count > 1 ? 's' : ''}{e.going && ' · tu y vas'}</p></div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function EventPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const [e, setE] = useState<CampusEvent | null>(null)
  const [msg, setMsg] = useState('')
  const load = useCallback(() => { api<CampusEvent>(`/events/${id}/`).then(setE).catch(() => setMsg('Événement introuvable.')) }, [id])
  useEffect(load, [load])
  if (!e) return msg ? <p className="pt-10 text-center text-muted">{msg}</p> : <div className="py-10"><Spinner /></div>

  const act = async (a: string) => { try { await api(`/events/${id}/${a}/`, { method: 'POST' }); load() } catch (x) { setMsg(x instanceof ApiError ? (x.data?.detail ?? x.text) : 'Erreur') } }
  async function share() {
    const url = location.href
    try { if (navigator.share) await navigator.share({ title: e!.title, url }); else { await navigator.clipboard.writeText(url); setMsg('Lien copié.') } } catch { /* cancelled */ }
  }
  async function remove() { if (confirm("Supprimer l'événement ?")) { await api(`/events/${id}/`, { method: 'DELETE' }); nav('/evenements') } }

  return (
    <div className="space-y-4 pt-6">
      <Link to="/evenements" className="text-sm text-primary">← Événements</Link>
      {e.image && <img src={e.image} alt="" className="max-h-64 w-full rounded-xl2 object-cover" />}
      <header><p className="text-xs text-primary">{CATS[e.category]}{e.is_past && ' · Terminé (archivé)'}</p><h1 className="text-xl font-bold">{e.title}</h1>
        <p className="text-sm text-muted">📅 {when(e.starts_at)}<br />📍 {e.location}<br />Organisé par @{e.organizer.username} · {e.going_count} participant{e.going_count > 1 ? 's' : ''}</p></header>
      <p className="whitespace-pre-wrap text-sm">{e.description}</p>
      {e.rules && <p className="card p-3 text-sm"><b>Règles de participation</b><br />{e.rules}</p>}
      {!e.is_past && (
        <div className="grid grid-cols-2 gap-2">
          <button className={e.going ? 'btn-outline' : 'btn'} onClick={() => act('rsvp')}>{e.going ? '✓ Je participe' : 'Je participe'}</button>
          <button className="btn-outline" onClick={() => act('reminder')}>{e.reminder ? '🔔 Rappel activé' : '🔔 Me rappeler'}</button>
        </div>
      )}
      <button className="btn-outline" onClick={share}>Partager</button>
      {e.reminder && <p className="text-xs text-muted">Le rappel est enregistré dans « Mes rappels » (pas de notification push pour l'instant).</p>}
      {msg && <p className="text-sm text-muted" role="status">{msg}</p>}
      {user?.id === e.organizer.id && <button className="w-full py-1 text-sm text-danger" onClick={remove}>Supprimer l'événement</button>}
    </div>
  )
}

export function EventForm() {
  const nav = useNavigate()
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const fd = new FormData(ev.currentTarget)
    fd.set('starts_at', new Date(String(fd.get('starts_at'))).toISOString())
    if (!(fd.get('image') as File)?.size) fd.delete('image')
    setBusy(true); setErr('')
    try { const r = await api<CampusEvent>('/events/', { body: fd }); nav(`/evenements/${r.id}`, { replace: true }) }
    catch (x) { setErr(x instanceof ApiError ? (x.data?.detail ?? x.text) : 'Serveur injoignable.') } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="space-y-3 pt-6">
      <h1 className="text-2xl font-bold">Organiser un événement</h1>
      <input name="title" className="field" placeholder="Titre" maxLength={120} required />
      <select name="category" className="field" defaultValue="club">{Object.entries(CATS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <textarea name="description" className="field min-h-24" placeholder="Description" required />
      <input name="starts_at" type="datetime-local" className="field" required />
      <input name="location" className="field" placeholder="Lieu" maxLength={160} required />
      <input name="rules" className="field" placeholder="Règles de participation (facultatif)" maxLength={500} />
      <label className="text-xs text-muted">Image (facultatif)<input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="field mt-1" /></label>
      <ErrorBox>{err}</ErrorBox>
      <button className="btn" disabled={busy}>{busy ? 'Création…' : "Créer l'événement"}</button>
    </form>
  )
}
