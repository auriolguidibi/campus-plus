import { useState } from 'react'
import Icon from '../components/Icon'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import Bell from '../components/Bell'
import PostList from '../components/PostList'
import Stories from '../components/Stories'
import { Avatar, Logo } from '../components/ui'

const SCOPES = [['', 'Amis & groupes'], ['scope=campus', 'Tout le campus'], ['scope=favorites', 'Favoris']] as const

export default function Feed() {
  const { user } = useAuth()
  const [scope, setScope] = useState<string>('')

  return (
    <div className="pt-4">
      <div className="mb-4 flex items-center justify-between">
        <Logo size={30} />
        <div className="flex items-center gap-2"><Link to="/amis" aria-label="Amis" className="px-2"><Icon name="users" size={24} /></Link><Bell /></div>
      </div>
      <nav aria-label="Rubriques" className="mb-4 grid grid-cols-5 gap-2 text-center text-[11px] font-medium">
        {([['/marketplace', 'shop', 'Marketplace'], ['/defis', 'trophy', 'Défis'], ['/confessions', 'ghost', 'Confessions'], ['/evenements', 'calendar', 'Événements'], ['/classement', 'ranking', 'Classement']] as const).map(([to, icon, label]) => (
          <Link key={to} to={to} className="card flex flex-col items-center gap-1.5 py-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-link"><Icon name={icon} size={22} /></span>{label}</Link>
        ))}
      </nav>
      <Stories />
      <Link to="/creer" className="card mb-4 flex items-center gap-3 p-3 text-sm text-muted">
        {user && <Avatar user={user} size={36} />} Quoi de neuf sur le campus ?
      </Link>
      <div className="mb-4 flex gap-2 overflow-x-auto" role="tablist">
        {SCOPES.map(([v, label]) => (
          <button key={v} role="tab" aria-selected={scope === v} onClick={() => setScope(v)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${scope === v ? 'bg-primary text-primary-fg' : 'bg-soft text-muted'}`}>{label}</button>
        ))}
      </div>
      <PostList query={scope} empty={scope === '' ? 'Rien ici pour le moment. Ajoute des amis ou rejoins une communauté, ou regarde « Tout le campus ».' : 'Aucune publication.'} />
    </div>
  )
}
