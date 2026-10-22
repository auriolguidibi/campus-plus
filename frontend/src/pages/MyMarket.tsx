import { useCallback, useEffect, useState } from 'react'
import Icon from '../components/Icon'
import { Link } from 'react-router-dom'
import { api, fcfa, type Listing, type Offer, type Page } from '../api'
import ListingCard from '../components/ListingCard'
import { Spinner } from '../components/ui'

const TABS = [['listings', 'Annonces'], ['received', 'Offres reçues'], ['made', 'Mes offres'], ['favorites', 'Favoris'], ['purchases', 'Achats']] as const
type Tab = (typeof TABS)[number][0]
const OFFER_LABEL = { pending: 'En attente', countered: 'Contre-proposition', accepted: 'Acceptée', declined: 'Refusée', withdrawn: 'Retirée' }

function OfferRow({ o, seller, reload }: { o: Offer; seller: boolean; reload: () => void }) {
  const [counter, setCounter] = useState<string | null>(null)
  const act = async (a: string, body?: object) => { await api(`/offers/${o.id}/${a}/`, { method: 'POST', body }); setCounter(null); reload() }
  return (
    <div className="card space-y-2 p-3 text-sm">
      <div className="flex justify-between gap-2">
        <Link to={`/marketplace/${o.listing}`} className="truncate font-semibold">{o.listing_title}</Link>
        <span className="shrink-0 text-xs text-muted">{OFFER_LABEL[o.status]}</span>
      </div>
      <p>{seller && <>@{o.buyer.username} propose </>}<b>{fcfa(o.amount)}</b> <span className="text-muted">(demandé {fcfa(o.listing_price)})</span>
        {o.status === 'countered' && <> · contre-proposition <b>{fcfa(o.counter_amount ?? 0)}</b></>}</p>
      <div className="flex flex-wrap gap-2">
        {seller && o.status === 'pending' && (counter === null ? (
          <>
            <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg" onClick={() => act('accept')}>Accepter</button>
            <button className="rounded-lg border border-line px-3 py-1.5 text-xs" onClick={() => setCounter('')}>Contre-proposer</button>
            <button className="rounded-lg border border-line px-3 py-1.5 text-xs text-danger" onClick={() => act('decline')}>Refuser</button>
          </>
        ) : (
          <>
            <input className="field !w-32 !py-1.5" inputMode="numeric" placeholder="Montant" value={counter} onChange={(e) => setCounter(e.target.value.replace(/\D/g, ''))} />
            <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg" onClick={() => act('counter', { amount: Number(counter) })}>Envoyer</button>
          </>
        ))}
        {!seller && o.status === 'countered' && <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg" onClick={() => act('accept-counter')}>Accepter {fcfa(o.counter_amount ?? 0)}</button>}
        {!seller && (o.status === 'pending' || o.status === 'countered') && <button className="rounded-lg border border-line px-3 py-1.5 text-xs" onClick={() => act('withdraw')}>Retirer</button>}
        {o.conversation && <Link to={`/messages/${o.conversation}`} className="rounded-lg border border-line px-3 py-1.5 text-xs">Discuter</Link>}
      </div>
    </div>
  )
}

export default function MyMarket() {
  const [tab, setTab] = useState<Tab>('listings')
  const [listings, setListings] = useState<Listing[] | null>(null)
  const [offers, setOffers] = useState<Offer[] | null>(null)

  const load = useCallback(() => {
    setListings(null); setOffers(null)
    if (tab === 'received' || tab === 'made') api<Offer[]>(`/offers/?role=${tab === 'received' ? 'seller' : 'buyer'}`).then(setOffers)
    else api<Page<Listing>>(`/listings/?scope=${tab === 'listings' ? 'mine' : tab}`).then((p) => setListings(p.results))
  }, [tab])
  useEffect(load, [load])

  const loading = listings === null && offers === null
  const sold = (listings ?? []).filter((l) => l.status === 'sold')
  return (
    <div className="space-y-4 pt-6">
      <Link to="/marketplace" className="inline-flex items-center gap-1 text-sm font-semibold text-link"><Icon name="back" size={18} /> Marketplace</Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mon espace</h1>
        <Link to="/marketplace/nouveau" className="text-sm font-semibold text-link">+ Vendre</Link>
      </div>
      <div className="flex gap-2 overflow-x-auto" role="tablist">
        {TABS.map(([v, l]) => <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${tab === v ? 'bg-primary text-primary-fg' : 'bg-soft text-muted'}`}>{l}</button>)}
      </div>
      {loading && <Spinner />}
      {offers && (offers.length === 0 ? <p className="py-8 text-center text-sm text-muted">Aucune offre.</p>
        : <div className="space-y-3">{offers.map((o) => <OfferRow key={o.id} o={o} seller={tab === 'received'} reload={load} />)}</div>)}
      {listings && (listings.length === 0 ? <p className="py-8 text-center text-sm text-muted">Rien ici pour le moment.</p>
        : <div className="grid grid-cols-2 gap-3">{listings.map((l) => <ListingCard key={l.id} l={l} badge={tab === 'listings'} />)}</div>)}
      {tab === 'listings' && sold.length > 0 && (
        <p className="card p-3 text-sm">Historique : {sold.length} vente{sold.length > 1 ? 's' : ''} pour un total de <b>{fcfa(sold.reduce((s, l) => s + l.price, 0))}</b> (prix affichés).</p>
      )}
    </div>
  )
}
