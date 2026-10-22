import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import PostList from '../components/PostList'
import { Avatar, Logo } from '../components/ui'

const SCOPES = [['', 'Amis & groupes'], ['scope=campus', 'Tout le campus'], ['scope=favorites', 'Favoris']] as const

export default function Feed() {
  const { user } = useAuth()
  const [scope, setScope] = useState<string>('')

  return (
    <div className="pt-4">
      <div className="mb-4 flex items-center justify-between">
        <Logo size={30} />
        <Link to="/amis" className="text-sm font-semibold text-primary">Amis</Link>
      </div>
      <Link to="/marketplace" className="card mb-4 flex items-center gap-3 bg-primary/10 p-3">
        <span className="text-2xl">🛍️</span>
        <span className="flex-1"><b className="block">Marketplace</b><span className="text-xs text-muted">Achète et vends entre étudiants</span></span>
        <span className="text-primary">→</span>
      </Link>
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
