import { useCallback, useEffect, useMemo, useState } from 'react'
import Banner from '../components/Banner'
import Icon from '../components/Icon'
import { Link } from 'react-router-dom'
import { api, type Category, type Listing, type Page, type Seller } from '../api'
import ListingCard from '../components/ListingCard'
import { Avatar, ErrorBox, Spinner } from '../components/ui'

interface Highlights { deals: Listing[]; seller_of_week: Seller | null }

export default function Market() {
  const [cats, setCats] = useState<Category[]>([])
  const [hl, setHl] = useState<Highlights | null>(null)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [cond, setCond] = useState('')
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const [sort, setSort] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [items, setItems] = useState<Listing[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (q.trim()) p.set('q', q.trim())
    if (cat) p.set('category', cat)
    if (cond) p.set('condition', cond)
    if (min) p.set('min_price', min)
    if (max) p.set('max_price', max)
    if (sort) p.set('sort', sort)
    return p.toString()
  }, [q, cat, cond, min, max, sort])

  useEffect(() => {
    api<Category[]>('/market/categories/').then(setCats).catch(() => {})
    api<Highlights>('/market/highlights/').then(setHl).catch(() => {})
  }, [])

  const load = useCallback(async (path: string, reset: boolean) => {
    setLoading(true); setErr('')
    try {
      const page = await api<Page<Listing>>(path)
      setItems((old) => (reset ? page.results : [...old, ...page.results.filter((p) => !old.some((o) => o.id === p.id))]))
      setNext(page.next ? page.next.replace(/^.*\/api/, '') : null)
    } catch { setErr('Impossible de charger les annonces.') } finally { setLoading(false) }
  }, [])

  useEffect(() => { const t = setTimeout(() => load(`/listings/?${query}`, true), 250); return () => clearTimeout(t) }, [load, query])

  const filtered = query !== ''
  return (
    <div className="space-y-4 pt-6">
      <Banner title="Marketplace" subtitle="Achète et vends entre étudiants" icon="shop"
        action={<Link to="/marketplace/mes-annonces" className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold">Mon espace</Link>} />
      <div className="flex gap-2">
        <input className="field" placeholder="Rechercher un produit, service…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters} className="rounded-xl border border-line bg-soft px-4 text-sm font-semibold">Filtres</button>
      </div>
      {showFilters && (
        <div className="card grid grid-cols-2 gap-2 p-3">
          <input className="field" inputMode="numeric" placeholder="Prix min (FCFA)" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} />
          <input className="field" inputMode="numeric" placeholder="Prix max (FCFA)" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} />
          <select className="field" value={cond} onChange={(e) => setCond(e.target.value)} aria-label="État">
            <option value="">Neuf ou occasion</option><option value="new">Neuf</option><option value="used">Occasion</option>
          </select>
          <select className="field" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Tri">
            <option value="">Plus récentes</option><option value="price_asc">Prix croissant</option><option value="price_desc">Prix décroissant</option>
          </select>
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Catégories">
        {[{ id: 0, name: 'Tous' }, ...cats].map((c) => (
          <button key={c.id} role="tab" aria-selected={String(c.id || '') === cat} onClick={() => setCat(c.id ? String(c.id) : '')}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${String(c.id || '') === cat ? 'bg-primary text-primary-fg' : 'bg-soft text-muted'}`}>{c.name}</button>
        ))}
      </div>

      {!filtered && hl && (hl.deals.length > 0 || hl.seller_of_week) && (
        <section className="space-y-3">
          {hl.deals.length > 0 && (
            <>
              <h2 className="flex items-center gap-1.5 font-semibold">Bons plans du campus <Icon name="fire" bold size={18} className="text-amber-500" /></h2>
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4">
                {hl.deals.map((l) => <div key={l.id} className="w-40 shrink-0"><ListingCard l={l} /></div>)}
              </div>
            </>
          )}
          {hl.seller_of_week && (
            <Link to={`/u/${hl.seller_of_week.username}`} className="card flex items-center gap-3 bg-primary/10 p-3">
              <Avatar user={hl.seller_of_week} size={44} />
              <div className="flex-1">
                <p className="text-xs text-muted">Vendeur de la semaine</p>
                <p className="font-semibold">{hl.seller_of_week.first_name} {hl.seller_of_week.last_name}</p>
              </div>
              <span className="text-sm">{hl.seller_of_week.rating.avg ? <span className="flex items-center gap-1"><Icon name="star" bold size={16} className="text-amber-500" />{hl.seller_of_week.rating.avg}</span> : 'Nouveau'}</span>
            </Link>
          )}
          <h2 className="font-semibold">Toutes les annonces</h2>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">{items.map((l) => <ListingCard key={l.id} l={l} />)}</div>
      {loading && <div className="py-6"><Spinner /></div>}
      <ErrorBox>{err}</ErrorBox>
      {!loading && !err && items.length === 0 && <p className="py-10 text-center text-sm text-muted">{filtered ? 'Aucun résultat pour ces filtres.' : "Aucune annonce pour l'instant. Sois le premier à vendre !"}</p>}
      {next && !loading && <button className="btn-outline" onClick={() => load(next, false)}>Voir plus</button>}
      <Link to="/marketplace/nouveau" aria-label="Vendre un article"
        className="fixed bottom-24 right-4 z-10 flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-bold text-bg shadow-lg"><Icon name="add2" bold size={20} /> Vendre</Link>
    </div>
  )
}
