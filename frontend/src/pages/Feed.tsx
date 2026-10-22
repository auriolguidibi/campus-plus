import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import DataBar from '../components/DataBar'
import Icon from '../components/Icon'
import PostList from '../components/PostList'
import Stories from '../components/Stories'
import { Avatar } from '../components/ui'
import type { IconName } from '../icons'

const SCOPES = [['scope=home', 'Pour toi'], ['', 'Amis & groupes'], ['scope=favorites', 'Enregistrés']] as const

function useCounts() {
  const [c, setC] = useState({ friends: 0, messages: 0, notifications: 0 })
  useEffect(() => {
    const load = async () => {
      const [f, m, n] = await Promise.allSettled([
        api<unknown[]>('/friends/requests/'), api<{ unread: number }>('/conversations/unread/'), api<{ unread: number }>('/notifications/unread-count/'),
      ])
      setC({
        friends: f.status === 'fulfilled' ? f.value.length : 0,
        messages: m.status === 'fulfilled' ? m.value.unread : 0,
        notifications: n.status === 'fulfilled' ? n.value.unread : 0,
      })
    }
    load()
    const t = setInterval(load, 20000)
    return () => clearInterval(t)
  }, [])
  return c
}

const round = 'grid h-11 w-11 place-items-center rounded-full bg-soft'

export default function Feed() {
  const { user } = useAuth()
  const [scope, setScope] = useState<string>('scope=home')
  const counts = useCounts()

  const tabs: { to: string; icon: IconName; label: string; badge?: number; active?: boolean }[] = [
    { to: '/', icon: 'home', label: 'Accueil', active: true },
    { to: '/amis', icon: 'users', label: 'Amis', badge: counts.friends },
    { to: '/messages', icon: 'chat', label: 'Messages', badge: counts.messages },
    { to: '/defis', icon: 'trophy', label: 'Défis' },
    { to: '/notifications', icon: 'bell', label: 'Notifications', badge: counts.notifications },
    { to: '/marketplace', icon: 'shop', label: 'Marketplace' },
  ]

  return (
    <div className="-mx-4 space-y-1.5">
      <DataBar />

      <section className="bg-card px-4 pt-3">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-[34px] font-extrabold leading-none tracking-tight text-link" aria-label="Campus+">campus<span className="text-accent">+</span></Link>
          <div className="flex items-center gap-2.5">
            <Link to="/creer" aria-label="Créer" className={round}><Icon name="add" size={26} /></Link>
            <Link to="/recherche" aria-label="Rechercher" className={round}><Icon name="search" size={24} /></Link>
            <Link to="/menu" aria-label="Menu" className={round}><Icon name="menu" size={24} /></Link>
          </div>
        </div>
        <nav aria-label="Navigation principale" className="mt-3 grid grid-cols-6">
          {tabs.map((t) => (
            <Link key={t.to} to={t.to} aria-label={t.badge ? `${t.label}, ${t.badge} nouveau${t.badge > 1 ? 'x' : ''}` : t.label} aria-current={t.active ? 'page' : undefined}
              className={`relative flex justify-center border-b-[3px] pb-2.5 pt-1.5 ${t.active ? 'border-link text-link' : 'border-transparent text-muted'}`}>
              <span className="relative"><Icon name={t.icon} bold={t.active} size={30} />
                {!!t.badge && <span className="absolute -right-3 -top-2 min-w-[22px] rounded-full bg-danger px-1.5 py-0.5 text-center text-[12px] font-bold leading-none text-bg">{t.badge > 99 ? '99+' : t.badge}</span>}
              </span>
            </Link>
          ))}
        </nav>
      </section>

      <section className="flex items-center gap-3 bg-card px-4 py-3">
        <span className="relative">{user && <Avatar user={user} size={44} />}<span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-card bg-accent" aria-hidden /></span>
        <Link to="/creer" className="flex-1 rounded-full bg-soft px-4 py-3 text-[15px] text-fg">À quoi pensez-vous ?</Link>
        <Link to="/creer" className="flex flex-col items-center gap-0.5 text-xs text-fg" aria-label="Ajouter une photo"><Icon name="gallery" bold size={28} className="text-accent" />Photo</Link>
      </section>

      <section className="bg-card px-3 py-3"><Stories /></section>

      <div className="flex gap-2 overflow-x-auto bg-card px-4 py-2.5" role="tablist" aria-label="Fil d'actualité">
        {SCOPES.map(([v, label]) => (
          <button key={v} role="tab" aria-selected={scope === v} onClick={() => setScope(v)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${scope === v ? 'bg-primary text-primary-fg' : 'bg-soft text-muted'}`}>{label}</button>
        ))}
      </div>

      <div className="px-4">
        <PostList query={scope} empty={scope === 'scope=favorites' ? "Aucune publication enregistrée." : 'Aucune publication pour le moment. Sois le premier à écrire !'} />
      </div>
    </div>
  )
}
