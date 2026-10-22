import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fcfa, type Listing } from '../api'
import { Img } from '../dataMode'
import Icon from './Icon'
import { Avatar, timeAgo } from './ui'

export const STATUS_LABEL: Record<string, string> = {
  draft: 'Brouillon', pending: 'En modération', published: 'Publié', reserved: 'Réservé',
  sold: 'Vendu', rejected: 'Refusé', archived: 'Archivé',
}

/** Marketplace product card: photo with price pill, condition and favourite, then title, place/time and seller. */
export default function ListingCard({ l, badge, compact = false }: { l: Listing; badge?: boolean; compact?: boolean }) {
  const [fav, setFav] = useState(l.favorited)
  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    const { active } = await api<{ active: boolean }>(`/listings/${l.id}/favorite/`, { method: 'POST' })
    setFav(active)
  }
  const showStatus = badge || l.status === 'reserved' || l.status === 'sold'
  return (
    <Link to={`/marketplace/${l.id}`} className="group block overflow-hidden rounded-2xl border border-line bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[4/3] overflow-hidden bg-soft">
        {l.images[0] ? <Img src={l.images[0].url} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
          : <div className="grid h-full place-items-center text-muted"><Icon name="shop" size={40} /></div>}
        <span className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-bold ${l.condition === 'new' ? 'bg-accent text-bg' : 'bg-card/95 text-fg'}`}>{l.condition === 'new' ? 'Neuf' : 'Occasion'}</span>
        <button onClick={toggle} aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'} aria-pressed={fav}
          className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-card/95 shadow"><Icon name="heart" bold={fav} size={19} className={fav ? 'text-danger' : 'text-fg'} /></button>
        <span className="absolute bottom-2 left-2 rounded-xl bg-gradient-to-r from-violet-700 to-fuchsia-600 px-3 py-1 text-sm font-extrabold text-white shadow-lg">{fcfa(l.price)}</span>
        {showStatus && <span className="absolute bottom-2 right-2 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white">{STATUS_LABEL[l.status]}</span>}
      </div>
      <div className="space-y-1.5 p-3">
        <p className="truncate text-[15px] font-bold leading-tight">{l.title}</p>
        <p className="flex items-center gap-1 truncate text-xs text-muted"><Icon name="pin" size={13} />{l.location || 'Lieu à convenir'}<span aria-hidden>·</span>{timeAgo(l.created_at)}</p>
        {!compact && (
          <div className="flex items-center gap-2 border-t border-line pt-2">
            <Avatar user={l.seller} size={22} />
            <span className="min-w-0 flex-1 truncate text-xs font-semibold">{l.seller.first_name}</span>
            {l.seller.rating.avg && <span className="flex items-center gap-0.5 text-xs font-semibold"><Icon name="star" bold size={13} className="text-amber-500" />{l.seller.rating.avg}</span>}
            {l.negotiable && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-link">Négociable</span>}
          </div>
        )}
      </div>
    </Link>
  )
}
