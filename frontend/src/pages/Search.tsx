import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, fcfa, type Community, type Listing, type Page, type Profile } from '../api'
import Icon from '../components/Icon'
import { Avatar, Spinner } from '../components/ui'

/** Global search: every student of the campus (whatever their class), communities and Marketplace listings. */
export default function Search() {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<{ users: Profile[]; groups: Community[]; items: Listing[] } | null>(null)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setRes(null); return }
    const t = setTimeout(async () => {
      const enc = encodeURIComponent(term)
      const [users, groups, items] = await Promise.all([
        api<Profile[]>(`/users/?q=${enc}`).catch(() => []),
        api<Page<Community>>(`/communities/?q=${enc}`).then((p) => p.results).catch(() => []),
        api<Page<Listing>>(`/listings/?q=${enc}`).then((p) => p.results).catch(() => []),
      ])
      setRes({ users, groups, items })
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div className="space-y-4 pt-6">
      <div className="flex items-center gap-2 rounded-full border border-line bg-soft px-4 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
        <Icon name="search" size={22} className="text-muted" />
        <input autoFocus className="min-w-0 flex-1 bg-transparent py-3 text-[15px] outline-none placeholder:text-muted/70" placeholder="Rechercher sur Campus+" aria-label="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {q.trim().length < 2 && <p className="py-8 text-center text-sm text-muted">Cherche un étudiant (toutes les classes), une communauté ou un article.</p>}
      {q.trim().length >= 2 && res === null && <Spinner />}
      {res && (
        <>
          {res.users.length > 0 && (
            <section><h2 className="mb-2 font-semibold">Étudiants</h2>
              <div className="card divide-y divide-line px-3">
                {res.users.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 py-2.5">
                    <Link to={`/u/${u.username}`}><Avatar user={u} size={44} /></Link>
                    <Link to={`/u/${u.username}`} className="min-w-0 flex-1"><p className="truncate font-semibold">{u.first_name} {u.last_name}</p><p className="truncate text-xs text-muted">@{u.username} · {u.field_of_study} · {u.promotion}</p></Link>
                    <MessageButton id={u.id} />
                  </div>
                ))}
              </div></section>
          )}
          {res.groups.length > 0 && (
            <section><h2 className="mb-2 font-semibold">Communautés</h2>
              <div className="card divide-y divide-line px-3">{res.groups.map((g) => <Link key={g.id} to={`/communautes/${g.id}`} className="flex items-center justify-between py-3"><span className="font-semibold">{g.name}</span><span className="text-xs text-muted">{g.member_count} membres</span></Link>)}</div></section>
          )}
          {res.items.length > 0 && (
            <section><h2 className="mb-2 font-semibold">Marketplace</h2>
              <div className="card divide-y divide-line px-3">{res.items.map((l) => <Link key={l.id} to={`/marketplace/${l.id}`} className="flex items-center justify-between py-3"><span className="truncate font-semibold">{l.title}</span><span className="shrink-0 text-sm font-bold text-link">{fcfa(l.price)}</span></Link>)}</div></section>
          )}
          {!res.users.length && !res.groups.length && !res.items.length && <p className="py-8 text-center text-sm text-muted">Aucun résultat.</p>}
        </>
      )}
    </div>
  )
}


/** Opens (or creates) a private conversation with any student — no class or promotion restriction. */
export function MessageButton({ id, label = 'Message', className = '' }: { id: number; label?: string; className?: string }) {
  const nav = useNavigate()
  async function go() {
    try { const { id: cid } = await api<{ id: number }>('/conversations/', { body: { user_id: id } }); nav(`/messages/${cid}`) }
    catch { alert("Impossible d'ouvrir la conversation.") }
  }
  return <button onClick={go} className={`flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold text-link ${className}`}><Icon name="chat" size={18} /> {label}</button>
}
