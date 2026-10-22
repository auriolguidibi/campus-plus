import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type CampusEvent, type Community, type Page, type PublicUser } from '../api'
import Icon from './Icon'
import { Avatar } from './ui'

const card = 'rounded-2xl border border-line bg-card p-4'

function Head({ title, to }: { title: string; to: string }) {
  return <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">{title}</h2><Link to={to} className="text-xs font-semibold text-link">Voir tout <Icon name="next" size={12} className="inline" /></Link></div>
}

/** Desktop right column on the home page: people you may know, popular groups, next event. */
export default function RightRail() {
  const [people, setPeople] = useState<PublicUser[] | null>(null)
  const [groups, setGroups] = useState<Community[] | null>(null)
  const [event, setEvent] = useState<CampusEvent | null>(null)
  const [sent, setSent] = useState<number[]>([])

  useEffect(() => {
    api<PublicUser[]>('/friends/suggestions/').then((r) => setPeople(r.slice(0, 4))).catch(() => setPeople([]))
    api<Page<Community>>('/communities/?scope=discover').then((p) => setGroups(p.results.slice(0, 4))).catch(() => setGroups([]))
    api<Page<CampusEvent>>('/events/').then((p) => setEvent(p.results[0] ?? null)).catch(() => {})
  }, [])

  async function add(id: number) { await api(`/friends/request/${id}/`, { method: 'POST' }); setSent((s) => [...s, id]) }
  async function join(id: number) { await api(`/communities/${id}/join/`, { method: 'POST' }); setGroups((g) => g?.filter((x) => x.id !== id) ?? null) }
  const btn = 'shrink-0 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-1.5 text-xs font-bold text-white shadow shadow-primary/30'

  return (
    <aside className="hidden space-y-4 pb-8 lg:block" aria-label="Suggestions">
      <section className={card}>
        <Head title="Suggestions d'amis" to="/amis" />
        {people === null ? <p className="text-sm text-muted">Chargement…</p> : people.length === 0 ? <p className="text-sm text-muted">Plus de suggestions pour le moment.</p> : (
          <ul className="space-y-3">
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <Link to={`/u/${p.username}`}><Avatar user={p} size={44} /></Link>
                <Link to={`/u/${p.username}`} className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{p.first_name} {p.last_name}</p><p className="truncate text-xs text-muted">{p.promotion} {p.field_of_study}</p></Link>
                {sent.includes(p.id) ? <span className="text-xs font-semibold text-muted">Envoyée</span> : <button className={btn} onClick={() => add(p.id)}>Ajouter</button>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <Head title="Groupes populaires" to="/communautes" />
        {groups === null ? <p className="text-sm text-muted">Chargement…</p> : groups.length === 0 ? <p className="text-sm text-muted">Tu as déjà rejoint les groupes populaires.</p> : (
          <ul className="space-y-3">
            {groups.map((g) => (
              <li key={g.id} className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-link"><Icon name="users" bold size={22} /></span>
                <Link to={`/communautes/${g.id}`} className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{g.name}</p><p className="text-xs text-muted">{g.member_count} membre{g.member_count > 1 ? 's' : ''}</p></Link>
                <button className={btn} onClick={() => join(g.id)}>Rejoindre</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {event && (
        <Link to={`/evenements/${event.id}`} className="block rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-fuchsia-500 p-4 text-white shadow-lg shadow-primary/30">
          <p className="flex items-center gap-2 text-sm font-semibold text-white/90"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/20"><Icon name="calendar" bold size={20} /></span>Prochain événement</p>
          <p className="mt-3 text-lg font-extrabold leading-tight">{event.title}</p>
          <p className="mt-1 text-sm text-white/85">{new Date(event.starts_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })} · {new Date(event.starts_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
          <p className="text-sm text-white/85">{event.location}</p>
        </Link>
      )}
    </aside>
  )
}
