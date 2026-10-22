import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useCounts } from '../hooks'
import Icon from './Icon'
import { Avatar } from './ui'

/** Desktop top bar: global search, quick create, notifications and profile menu. */
export default function DesktopTopBar() {
  const { user } = useAuth()
  const counts = useCounts()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const submit = (e: FormEvent) => { e.preventDefault(); nav(`/recherche${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`) }
  return (
    <header className="sticky top-0 z-20 hidden items-center gap-4 bg-bg/90 py-4 backdrop-blur lg:flex">
      <form onSubmit={submit} role="search" className="flex flex-1 items-center gap-3 rounded-full border border-line bg-card px-5 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
        <Icon name="search" size={20} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" placeholder="Rechercher des personnes, des groupes, des publications…"
          className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted/70" />
      </form>
      <Link to="/creer" aria-label="Créer une publication" className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-fg shadow-md shadow-primary/30"><Icon name="add" bold size={24} /></Link>
      <Link to="/notifications" aria-label={counts.notifications ? `Notifications, ${counts.notifications} non lues` : 'Notifications'} className="relative grid h-11 w-11 place-items-center rounded-full bg-card ring-1 ring-line">
        <Icon name="bell" size={22} />
        {counts.notifications > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-danger px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-bg">{counts.notifications}</span>}
      </Link>
      {user && <Link to="/profil" aria-label="Mon profil" className="rounded-full ring-2 ring-primary/40"><Avatar user={user} size={44} /></Link>}
    </header>
  )
}
