import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Banner from '../components/Banner'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, type CampusEvent, type Page } from '../api'
import { useAuth } from '../auth'
import Icon from '../components/Icon'
import { Field, SelectField, Submit, TextArea } from '../components/form'
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
      <Banner title="Événements" subtitle="Soirées, hackathons, conférences…" icon="calendar"
        action={<Link to="/evenements/nouveau" className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold">Organiser</Link>} />
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-soft p-1" role="tablist">
        {([['upcoming', 'À venir'], ['reminders', 'Mes rappels'], ['past', 'Archives']] as const).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={`rounded-lg py-2 text-xs font-semibold ${tab === v ? 'bg-primary text-primary-fg' : 'text-muted'}`}>{l}</button>
        ))}
      </div>
      {items === null ? <Spinner /> : items.length === 0 ? <p className="py-8 text-center text-sm text-muted">Aucun événement.</p> : (
        <div className="space-y-3">
          {items.map((e) => (
            <Link key={e.id} to={`/evenements/${e.id}`} className="card block overflow-hidden">
              <img src={e.image ?? '/img/campus.jpg'} alt="" loading="lazy" className="h-32 w-full object-cover" />
              <div className="p-4"><p className="text-xs text-link">{CATS[e.category]}</p><p className="font-semibold">{e.title}</p>
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
      <Link to="/evenements" className="inline-flex items-center gap-1 text-sm font-semibold text-link"><Icon name="back" size={18} /> Événements</Link>
      {e.image && <img src={e.image} alt="" className="max-h-64 w-full rounded-xl2 object-cover" />}
      <header><p className="text-xs text-link">{CATS[e.category]}{e.is_past && ' · Terminé (archivé)'}</p><h1 className="text-xl font-bold">{e.title}</h1>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          <li className="flex items-center gap-2"><Icon name="calendar" size={18} /> {when(e.starts_at)}</li>
          <li className="flex items-center gap-2"><Icon name="pin" size={18} /> {e.location}</li>
          <li className="flex items-center gap-2"><Icon name="user" size={18} /> @{e.organizer.username} · {e.going_count} participant{e.going_count > 1 ? 's' : ''}</li></ul></header>
      <p className="whitespace-pre-wrap text-sm">{e.description}</p>
      {e.rules && <p className="card p-3 text-sm"><b>Règles de participation</b><br />{e.rules}</p>}
      {!e.is_past && (
        <div className="grid grid-cols-2 gap-2">
          <button className={`flex items-center justify-center gap-2 ${e.going ? 'btn-outline' : 'btn'}`} onClick={() => act('rsvp')}><Icon name="check" bold={e.going} size={20} /> Je participe</button>
          <button className="btn-outline flex items-center justify-center gap-2" onClick={() => act('reminder')}><Icon name="bell" bold={e.reminder} size={20} /> {e.reminder ? 'Rappel activé' : 'Me rappeler'}</button>
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
      <Field name="title" label="Titre" icon="calendar" maxLength={120} placeholder="Hackathon Campus+" required />
      <SelectField name="category" label="Type d'événement" icon="fire" defaultValue="club">{Object.entries(CATS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</SelectField>
      <TextArea name="description" label="Description" icon="notebook" required />
      <Field name="starts_at" label="Date et heure" icon="clock" type="datetime-local" required />
      <Field name="location" label="Lieu" icon="pin" maxLength={160} placeholder="Amphi A" required />
      <Field name="rules" label="Règles de participation" icon="shield" maxLength={500} hint="Facultatif" />
      <label className="btn-outline flex cursor-pointer items-center justify-center gap-2"><Icon name="gallery" size={20} /> Ajouter une image<input name="image" type="file" accept="image/jpeg,image/png,image/webp" hidden /></label>
      <ErrorBox>{err}</ErrorBox>
      <Submit busy={busy} icon="add2">Créer l'événement</Submit>
    </form>
  )
}
