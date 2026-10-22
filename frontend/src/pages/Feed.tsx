import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import Icon from '../components/Icon'
import PostList from '../components/PostList'
import Stories from '../components/Stories'
import { Avatar } from '../components/ui'

const SCOPES = [['scope=home', 'Pour toi'], ['', 'Amis & groupes'], ['scope=favorites', 'Enregistrés']] as const

export default function Feed() {
  const { user } = useAuth()
  const [scope, setScope] = useState<string>('scope=home')

  return (
    <div className="-mx-4 -mt-4 space-y-1.5 lg:mx-0 lg:mt-0 lg:space-y-4">
      <section className="flex flex-wrap items-center gap-3 bg-card px-4 py-3 lg:rounded-2xl lg:border lg:border-line lg:p-4">
        <span className="relative">{user && <Avatar user={user} size={44} />}<span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-card bg-accent" aria-hidden /></span>
        <Link to="/creer" className="flex-1 rounded-full bg-soft px-4 py-3 text-[15px] text-fg">À quoi pensez-vous ?</Link>
        <Link to="/creer" className="flex flex-col items-center gap-0.5 text-xs text-fg lg:hidden" aria-label="Ajouter une photo"><Icon name="gallery" bold size={28} className="text-accent" />Photo</Link>
        <div className="hidden w-full gap-3 lg:flex">
          {([['/creer', 'gallery', 'Photo', 'text-accent'], ['/marketplace/nouveau', 'shop', 'Vendre', 'text-fuchsia-500'], ['/evenements/nouveau', 'calendar', 'Événement', 'text-amber-500'], ['/defis', 'trophy', 'Défi', 'text-link']] as const).map(([to, icon, label, color]) => (
            <Link key={label} to={to} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-soft py-3 text-sm font-semibold"><Icon name={icon} bold size={20} className={color} />{label}</Link>
          ))}
        </div>
      </section>

      <section className="bg-card px-3 py-3 lg:rounded-2xl lg:border lg:border-line lg:p-4"><Stories /></section>

      <div className="flex gap-2 overflow-x-auto bg-card px-4 py-2.5 lg:rounded-2xl lg:border lg:border-line" role="tablist" aria-label="Fil d'actualité">
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
