import { useState } from 'react'
import { Img } from '../dataMode'
import Icon from './Icon'
import { Link } from 'react-router-dom'
import { api, fcfa, type Listing } from '../api'

export const STATUS_LABEL: Record<string, string> = {
  draft: 'Brouillon', pending: 'En modération', published: 'Publié', reserved: 'Réservé',
  sold: 'Vendu', rejected: 'Refusé', archived: 'Archivé',
}

export default function ListingCard({ l, badge }: { l: Listing; badge?: boolean }) {
  const [fav, setFav] = useState(l.favorited)
  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    const { active } = await api<{ active: boolean }>(`/listings/${l.id}/favorite/`, { method: 'POST' })
    setFav(active)
  }
  return (
    <Link to={`/marketplace/${l.id}`} className="card block overflow-hidden">
      <div className="relative aspect-square bg-soft">
        {l.images[0] ? <Img src={l.images[0].url} className="h-full w-full object-cover" />
          : <div className="grid h-full place-items-center text-muted"><Icon name="shop" size={40} /></div>}
        <button onClick={toggle} aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-card/90 text-lg"><Icon name="heart" bold={fav} size={18} className={fav ? 'text-danger' : ''} /></button>
        {(badge || l.status === 'reserved') && (
          <span className="absolute left-2 top-2 rounded-full bg-card/90 px-2 py-0.5 text-[11px] font-semibold">{STATUS_LABEL[l.status]}</span>
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-semibold">{l.title}</p>
        <p className="font-bold text-link">{fcfa(l.price)}</p>
        <p className="truncate text-xs text-muted">{l.condition === 'new' ? 'Neuf' : 'Occasion'}{l.location && ` · ${l.location}`}</p>
      </div>
    </Link>
  )
}
