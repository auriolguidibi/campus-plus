import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../auth'
import { useCounts } from '../hooks'
import type { IconName } from '../icons'
import Icon from './Icon'
import { Avatar, Logo } from './ui'

/** Desktop left column: logo, main navigation, promo card and the signed-in user (lg screens and up). */
export default function Sidebar() {
  const { user } = useAuth()
  const counts = useCounts()
  const items: { to: string; icon: IconName; label: string; badge?: number; end?: boolean }[] = [
    { to: '/', icon: 'home', label: 'Accueil', end: true },
    { to: '/communautes', icon: 'users', label: 'Communautés' },
    { to: '/amis', icon: 'userPlus', label: 'Amis', badge: counts.friends },
    { to: '/messages', icon: 'chat', label: 'Messages', badge: counts.messages },
    { to: '/evenements', icon: 'calendar', label: 'Événements' },
    { to: '/marketplace', icon: 'shop', label: 'Marketplace' },
    { to: '/defis', icon: 'trophy', label: 'Défis & Battles' },
    { to: '/confessions', icon: 'ghost', label: 'Confessions' },
    { to: '/classement', icon: 'ranking', label: 'Classements' },
    { to: '/recherche', icon: 'search', label: 'Explorer' },
    { to: '/menu', icon: 'settings', label: 'Paramètres' },
  ]
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-3 overflow-y-auto py-5 lg:flex" aria-label="Navigation">
      <Link to="/" className="px-2" aria-label="EIG Vibes, accueil"><Logo size={44} /></Link>
      <nav className="mt-2 flex flex-col gap-1">
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end}
            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-semibold transition ${isActive ? 'bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-md shadow-primary/30' : 'text-fg hover:bg-soft'}`}>
            {({ isActive }) => (<>
              <Icon name={it.icon} bold={isActive} size={22} />
              <span className="flex-1">{it.label}</span>
              {!!it.badge && <span className={`grid min-w-6 place-items-center rounded-full px-1.5 py-0.5 text-xs font-bold ${isActive ? 'bg-white text-violet-700' : 'bg-primary text-primary-fg'}`}>{it.badge}</span>}
            </>)}
          </NavLink>
        ))}
      </nav>

      <Link to="/defis" className="mt-2 block rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-fuchsia-500 p-4 text-white shadow-lg shadow-primary/30">
        <Icon name="crown" bold size={26} className="text-amber-300" />
        <p className="mt-2 text-sm font-bold leading-snug">Relève les défis EIG Vibes !</p>
        <p className="mt-1 text-xs text-white/85">Plein de fun, des cadeaux et des points à gagner.</p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-violet-700">Découvrir <Icon name="next" size={14} /></span>
      </Link>

      {user && (
        <div className="mt-auto rounded-2xl border border-line bg-card p-3">
          <div className="flex items-center gap-3">
            <span className="relative"><Avatar user={user} size={44} /><span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-accent" aria-hidden /></span>
            <div className="min-w-0"><p className="truncate text-sm font-bold">{user.first_name} {user.last_name}</p>
              <p className="text-xs font-semibold text-accent">En ligne</p>
              <p className="truncate text-xs text-muted">{user.promotion} {user.field_of_study}</p></div>
          </div>
          <Link to="/profil" className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-soft py-2 text-sm font-semibold text-link"><Icon name="user" size={18} /> Voir profil</Link>
        </div>
      )}
    </aside>
  )
}
