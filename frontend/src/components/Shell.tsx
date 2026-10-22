import { useEffect, useState } from 'react'
import { NavLink, Outlet, useMatch } from 'react-router-dom'
import { CallProvider } from '../calls'
import Icon from './Icon'
import { api } from '../api'

const tabs = [
  { to: '/', label: 'Accueil', icon: 'home' },
  { to: '/communautes', label: 'Communautés', icon: 'users' },
  { to: '/messages', label: 'Messages', icon: 'chat' },
  { to: '/profil', label: 'Profil', icon: 'user' },
] as const

function Tab({ t, badge = 0 }: { t: (typeof tabs)[number]; badge?: number }) {
  return (
    <NavLink to={t.to} end={t.to === '/'} className={({ isActive }) =>
      `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-link' : 'text-muted'}`}>
      <span className="relative">
        <Icon name={t.icon} size={24} bold={useMatch(t.to === '/' ? { path: '/', end: true } : { path: t.to, end: false }) !== null} />
        {badge > 0 && <span className="absolute -right-2 -top-1 rounded-full bg-danger px-1 text-[10px] font-bold text-bg">{badge}</span>}
      </span>
      {t.label}
    </NavLink>
  )
}

export default function Shell() {
  const [unread, setUnread] = useState(0)
  useEffect(() => {
    const load = () => api<{ unread: number }>('/conversations/unread/').then((r) => setUnread(r.unread)).catch(() => {})
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])
  return (
    <CallProvider>
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <main className="flex-1 px-4 pb-24 pt-safe"><Outlet /></main>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center">
          <Tab t={tabs[0]} /><Tab t={tabs[1]} />
          <NavLink to="/creer" aria-label="Créer une publication"
            className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-fg shadow-lg shadow-primary/40"><Icon name="plus" bold size={34} /></NavLink>
          <Tab t={tabs[2]} badge={unread} /><Tab t={tabs[3]} />
        </div>
      </nav>
    </div>
    </CallProvider>
  )
}
