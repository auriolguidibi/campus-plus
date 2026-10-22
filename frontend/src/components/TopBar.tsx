import { Link, useLocation } from 'react-router-dom'
import { useCounts } from '../hooks'
import type { IconName } from '../icons'
import DataBar from './DataBar'
import Icon from './Icon'
import { Logo } from './ui'

const round = 'grid h-11 w-11 place-items-center rounded-full bg-soft'

/** Single global navigation (the only one): shown on every page, like Facebook's top bar. */
export default function TopBar() {
  const { pathname } = useLocation()
  const counts = useCounts()
  const home = pathname === '/'

  const tabs: { to: string; icon: IconName; label: string; badge?: number; active: boolean }[] = [
    { to: '/', icon: 'home', label: 'Accueil', active: home },
    { to: '/amis', icon: 'users', label: 'Amis', badge: counts.friends, active: pathname.startsWith('/amis') },
    { to: '/messages', icon: 'chat', label: 'Messages', badge: counts.messages, active: pathname.startsWith('/messages') },
    { to: '/defis', icon: 'trophy', label: 'Défis', active: pathname.startsWith('/defis') },
    { to: '/notifications', icon: 'bell', label: 'Notifications', badge: counts.notifications, active: pathname.startsWith('/notifications') },
    { to: '/marketplace', icon: 'shop', label: 'Marketplace', active: pathname.startsWith('/marketplace') },
  ]

  return (
    <div className="space-y-1.5 pt-safe">
      {home && <DataBar />}
      <section className="bg-card px-4 pt-3">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label="EIG Vibes, accueil"><Logo size={40} /></Link>
          <div className="flex items-center gap-2.5">
            <Link to="/creer" aria-label="Créer une publication" className={round}><Icon name="add" size={26} /></Link>
            <Link to="/recherche" aria-label="Rechercher" className={round}><Icon name="search" size={24} /></Link>
            <Link to="/menu" aria-label="Menu" className={round}><Icon name="menu" size={24} /></Link>
          </div>
        </div>
        <nav aria-label="Navigation principale" className="mt-3 grid grid-cols-6">
          {tabs.map((t) => (
            <Link key={t.to} to={t.to} aria-current={t.active ? 'page' : undefined}
              aria-label={t.badge ? `${t.label}, ${t.badge} nouveau${t.badge > 1 ? 'x' : ''}` : t.label}
              className={`relative flex justify-center border-b-[3px] pb-2.5 pt-1.5 ${t.active ? 'border-link text-link' : 'border-transparent text-muted'}`}>
              <span className="relative"><Icon name={t.icon} bold={t.active} size={30} />
                {!!t.badge && <span className="absolute -right-3 -top-2 min-w-[22px] rounded-full bg-danger px-1.5 py-0.5 text-center text-[12px] font-bold leading-none text-bg">{t.badge > 99 ? '99+' : t.badge}</span>}
              </span>
            </Link>
          ))}
        </nav>
      </section>
    </div>
  )
}
