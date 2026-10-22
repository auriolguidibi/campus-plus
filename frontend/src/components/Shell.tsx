import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { api } from '../api'

const tabs = [
  { to: '/', label: 'Accueil', icon: 'M3 11 12 3l9 8v10h-6v-6H9v6H3z' },
  { to: '/communautes', label: 'Communautés', icon: 'M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3M8 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3m0 2c-3 0-6 1.500-6 4v2h12v-2c0-2.500-3-4-6-4m8 0-1.500.1c1.500 1 2.500 2.300 2.500 3.900v2h6v-2c0-2.500-3-4-7-4' },
  { to: '/messages', label: 'Messages', icon: 'M4 4h16v12H8l-4 4z' },
  { to: '/profil', label: 'Profil', icon: 'M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5m0 2c-4 0-8 2-8 5v2h16v-2c0-3-4-5-8-5' },
]

function Tab({ t, badge = 0 }: { t: (typeof tabs)[number]; badge?: number }) {
  return (
    <NavLink to={t.to} end={t.to === '/'} className={({ isActive }) =>
      `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-link' : 'text-muted'}`}>
      <span className="relative">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={t.icon} /></svg>
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
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <main className="flex-1 px-4 pb-24 pt-safe"><Outlet /></main>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center">
          <Tab t={tabs[0]} /><Tab t={tabs[1]} />
          <NavLink to="/creer" aria-label="Créer une publication"
            className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-primary text-3xl text-primary-fg shadow-lg">+</NavLink>
          <Tab t={tabs[2]} badge={unread} /><Tab t={tabs[3]} />
        </div>
      </nav>
    </div>
  )
}
