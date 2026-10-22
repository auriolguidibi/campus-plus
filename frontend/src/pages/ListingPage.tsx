import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, fcfa, type Listing, type PublicUser } from '../api'
import { useAuth } from '../auth'
import { STATUS_LABEL } from '../components/ListingCard'
import { Avatar, ErrorBox, Spinner } from '../components/ui'

interface Review { id: number; rating: number; comment: string; listing: string; reviewer: PublicUser }

function Stars({ n }: { n: number }) { return <span aria-label={`${n} sur 5`}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span> }

export default function ListingPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const [l, setL] = useState<Listing | null>(null)
  const [missing, setMissing] = useState(false)
  const [pic, setPic] = useState(0)
  const [offer, setOffer] = useState<string | null>(null)
  const [buyers, setBuyers] = useState<PublicUser[] | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    api<Listing>(`/listings/${id}/`).then((x) => { setL(x); api<Review[]>(`/listings/${id}/reviews/`).then(setReviews).catch(() => {}) }).catch(() => setMissing(true))
  }, [id])
  useEffect(load, [load])

  if (missing) return <p className="pt-10 text-center text-muted">Annonce introuvable.</p>
  if (!l || !user) return <div className="py-10"><Spinner /></div>
  const mine = l.seller.id === user.id
  const open = l.status === 'published' || l.status === 'reserved'

  async function run(fn: () => Promise<unknown>) {
    setErr('')
    try { await fn(); load() } catch (x) { setErr(x instanceof ApiError ? (x.data?.detail ?? x.text) : 'Serveur injoignable.') }
  }
  async function contact() {
    try { const { id: cid } = await api<{ id: number }>(`/listings/${l!.id}/contact/`, { method: 'POST' }); nav(`/messages/${cid}`) }
    catch (x) { setErr(x instanceof ApiError ? (x.data?.detail ?? x.text) : 'Erreur') }
  }
  async function sendOffer() {
    await run(async () => { await api(`/listings/${l!.id}/offers/`, { body: { amount: Number(offer) } }); setOffer(null) })
  }
  async function pickBuyer() { setBuyers(await api<PublicUser[]>(`/listings/${l!.id}/buyers/`)) }
  async function remove() {
    if (!confirm("Supprimer cette annonce ? Si elle a déjà des offres ou une vente, elle sera archivée.")) return
    await api(`/listings/${l!.id}/`, { method: 'DELETE' }); nav('/marketplace/mes-annonces')
  }

  return (
    <div className="space-y-4 pt-6">
      <Link to="/marketplace" className="text-sm text-primary">← Marketplace</Link>
      <div>
        <div className="aspect-square overflow-hidden rounded-xl2 bg-soft">
          {l.images[pic] ? <img src={l.images[pic].url} alt={l.title} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-5xl">🛍️</div>}
        </div>
        {l.images.length > 1 && (
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {l.images.map((im, i) => (
              <button key={im.id} onClick={() => setPic(i)} aria-label={`Photo ${i + 1}`} className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${i === pic ? 'border-primary' : 'border-transparent'}`}>
                <img src={im.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <header>
        <h1 className="text-xl font-bold">{l.title}</h1>
        <p className="text-2xl font-extrabold text-primary">{fcfa(l.price)}</p>
        <p className="mt-1 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-soft px-2 py-0.5">{l.condition === 'new' ? 'Neuf' : 'Occasion'}</span>
          <span className="rounded-full bg-soft px-2 py-0.5">{l.category.name}</span>
          <span className={`rounded-full px-2 py-0.5 ${open ? 'bg-accent/15 text-accent' : 'bg-soft text-muted'}`}>{STATUS_LABEL[l.status]}</span>
          {l.negotiable && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">Négociable</span>}
        </p>
      </header>
      <p className="whitespace-pre-wrap break-words text-sm">{l.description}</p>
      <p className="text-sm text-muted">Disponibilité : {l.quantity} · {l.location || 'Lieu à convenir'}
        {l.handover.length > 0 && ` · ${l.handover.map((h) => ({ meetup: 'main propre', campus: 'campus', delivery: 'livraison' } as Record<string, string>)[h]).join(', ')}`}</p>

      <Link to={`/u/${l.seller.username}`} className="card flex items-center gap-3 p-3">
        <Avatar user={l.seller} size={44} />
        <div className="flex-1">
          <p className="font-semibold">{l.seller.first_name} {l.seller.last_name}</p>
          <p className="text-xs text-muted">{l.seller.rating.avg ? `★ ${l.seller.rating.avg} (${l.seller.rating.count} avis)` : 'Pas encore d\'avis'} · {l.seller.sales} vente{l.seller.sales > 1 ? 's' : ''}</p>
        </div>
      </Link>

      <ErrorBox>{err}</ErrorBox>

      {!mine && open && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button className="btn" onClick={contact}>Contacter le vendeur</button>
            <button className="btn-outline !w-auto px-4" onClick={() => run(() => api(`/listings/${l.id}/favorite/`, { method: 'POST' }))} aria-label="Favoris">{l.favorited ? '♥' : '♡'}</button>
          </div>
          {l.my_offer ? (
            <p className="card p-3 text-sm">Ton offre : <b>{fcfa(l.my_offer.amount)}</b> — {({ pending: 'en attente', countered: `contre-proposition ${fcfa(l.my_offer.counter_amount ?? 0)}`, accepted: 'acceptée !' } as Record<string, string>)[l.my_offer.status]}
              {' '}<Link to={`/messages/${l.my_offer.conversation}`} className="text-primary">Voir la conversation</Link></p>
          ) : l.negotiable && l.status === 'published' && (offer === null
            ? <button className="btn-outline" onClick={() => setOffer('')}>Faire une offre</button>
            : (
              <div className="flex gap-2">
                <input className="field" inputMode="numeric" placeholder={`Moins de ${fcfa(l.price)}`} value={offer} onChange={(e) => setOffer(e.target.value.replace(/\D/g, ''))} autoFocus />
                <button className="rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg" onClick={sendOffer} disabled={!offer}>Envoyer</button>
              </div>
            ))}
        </div>
      )}
      {!mine && !open && <p className="text-sm text-muted">Cette annonce n'est plus disponible.</p>}
      {!mine && l.bought_by_me && !reviews.some((r) => r.listing === l.title && r.reviewer.id === user.id) && (
        <section className="card space-y-2 p-4">
          <h2 className="font-semibold">Laisser un avis vérifié</h2>
          <div className="flex gap-1 text-2xl text-primary">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setRating(n)} aria-label={`${n} étoiles`}>{n <= rating ? '★' : '☆'}</button>)}</div>
          <input className="field" placeholder="Commentaire (facultatif)" maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
          <button className="btn" onClick={() => run(() => api(`/listings/${l.id}/reviews/`, { body: { rating, comment } }))}>Publier l'avis</button>
        </section>
      )}

      {mine && (
        <section className="card space-y-2 p-4">
          <h2 className="font-semibold">Gérer mon annonce</h2>
          {l.status !== 'sold' && l.status !== 'rejected' && <Link to={`/marketplace/${l.id}/modifier`} className="btn-outline block text-center">Modifier</Link>}
          {l.status === 'draft' && <button className="btn" onClick={() => run(() => api(`/listings/${l.id}/set-status/`, { body: { status: 'published' } }))}>Publier</button>}
          {l.status === 'pending' && <p className="text-sm text-muted">En attente de modération.</p>}
          {l.status === 'published' && <button className="btn-outline" onClick={() => run(() => api(`/listings/${l.id}/set-status/`, { body: { status: 'reserved' } }))}>Marquer comme réservé</button>}
          {l.status === 'reserved' && <button className="btn-outline" onClick={() => run(() => api(`/listings/${l.id}/set-status/`, { body: { status: 'published' } }))}>Remettre en vente</button>}
          {(l.status === 'published' || l.status === 'reserved') && (
            buyers === null ? <button className="btn" onClick={pickBuyer}>Marquer comme vendu</button> : (
              <div className="space-y-2">
                <p className="text-sm">À qui l'as-tu vendu ? (l'acheteur pourra laisser un avis vérifié)</p>
                {buyers.map((b) => <button key={b.id} className="btn-outline" onClick={() => run(() => api(`/listings/${l.id}/mark-sold/`, { body: { buyer_id: b.id } }))}>@{b.username}</button>)}
                <button className="w-full py-1 text-sm text-muted" onClick={() => run(() => api(`/listings/${l.id}/mark-sold/`, { body: {} }))}>Vendu hors Campus+ (sans avis)</button>
              </div>
            )
          )}
          {(l.status === 'published' || l.status === 'draft') && <button className="w-full py-1 text-sm text-muted" onClick={() => run(() => api(`/listings/${l.id}/set-status/`, { body: { status: 'archived' } }))}>Archiver</button>}
          <button className="w-full py-1 text-sm text-danger" onClick={remove}>Supprimer</button>
        </section>
      )}

      {reviews.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Avis sur le vendeur</h2>
          {reviews.map((r) => (
            <div key={r.id} className="card p-3 text-sm">
              <p><b>{r.reviewer.first_name}</b> <span className="text-primary"><Stars n={r.rating} /></span> <span className="text-xs text-muted">· {r.listing}</span></p>
              {r.comment && <p className="mt-1">{r.comment}</p>}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
