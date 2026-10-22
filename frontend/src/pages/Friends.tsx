import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Profile, type PublicUser } from '../api'
import { Avatar } from '../components/ui'
import { MessageButton } from './Search'

function Row({ u, children }: { u: PublicUser; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Link to={`/u/${u.username}`}><Avatar user={u} /></Link>
      <Link to={`/u/${u.username}`} className="min-w-0 flex-1">
        <p className="truncate font-semibold">{u.first_name} {u.last_name}</p>
        <p className="truncate text-xs text-muted">@{u.username} · {u.field_of_study}</p>
      </Link>
      {children}
    </div>
  )
}

export default function Friends() {
  const [friends, setFriends] = useState<PublicUser[]>([])
  const [requests, setRequests] = useState<PublicUser[]>([])
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Profile[]>([])

  const load = useCallback(() => {
    api<PublicUser[]>('/friends/').then(setFriends)
    api<PublicUser[]>('/friends/requests/').then(setRequests)
  }, [])
  useEffect(load, [load])

  useEffect(() => {
    if (q.trim().length < 2) { setFound([]); return }
    const t = setTimeout(() => api<Profile[]>(`/users/?q=${encodeURIComponent(q.trim())}`).then(setFound).catch(() => {}), 300)
    return () => clearTimeout(t)
  }, [q])

  async function act(id: number, action: string) {
    await api(`/friends/${action}/${id}/`, { method: 'POST' })
    load()
    if (q.trim().length >= 2) api<Profile[]>(`/users/?q=${encodeURIComponent(q.trim())}`).then(setFound)
  }

  return (
    <div className="space-y-5 pt-6">
      <h1 className="text-2xl font-bold">Amis</h1>
      <input className="field" placeholder="Rechercher un étudiant (nom ou pseudo)…" value={q} onChange={(e) => setQ(e.target.value)} />
      {q.trim().length >= 2 && (
        <section className="card px-4 py-2">
          {found.length === 0 && <p className="py-3 text-sm text-muted">Aucun résultat.</p>}
          {found.map((u) => (
            <Row key={u.id} u={u}>
              {u.relation === 'none' && <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg" onClick={() => act(u.id, 'request')}>Ajouter</button>}
              {u.relation === 'request_received' && <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg" onClick={() => act(u.id, 'accept')}>Accepter</button>}
              {u.relation === 'request_sent' && <span className="text-xs text-muted">Envoyée</span>}
              {u.relation === 'friends' && <span className="text-xs text-accent">Ami</span>}
            </Row>
          ))}
        </section>
      )}
      {requests.length > 0 && (
        <section>
          <h2 className="font-semibold">Demandes reçues ({requests.length})</h2>
          <div className="card mt-2 px-4 py-2">
            {requests.map((u) => (
              <Row key={u.id} u={u}>
                <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg" onClick={() => act(u.id, 'accept')}>Accepter</button>
                <button className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted" onClick={() => act(u.id, 'decline')}>Refuser</button>
              </Row>
            ))}
          </div>
        </section>
      )}
      <section>
        <h2 className="font-semibold">Mes amis ({friends.length})</h2>
        <div className="card mt-2 px-4 py-2">
          {friends.length === 0 && <p className="py-3 text-sm text-muted">Pas encore d'amis. Utilise la recherche ci-dessus.</p>}
          {friends.map((u) => <Row key={u.id} u={u}><MessageButton id={u.id} label="" /></Row>)}
        </div>
      </section>
    </div>
  )
}
