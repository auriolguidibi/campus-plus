import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Category, type Listing, type Page, type Seller } from '../api'
import Icon from '../components/Icon'
import ListingCard from '../components/ListingCard'
import { Avatar, ErrorBox, Spinner } from '../components/ui'
import { useBackgrounds } from '../dataMode'
import type { IconName } from '../icons'

interface Highlights { deals: Listing[]; seller_of_week: Seller | null }

const catIcon = (name: string): IconName => {
  const n = name.toLowerCase()
  if (n.includes('mode')) return 'shirt'
  if (n.includes('informatique')) return 'laptop'
  if (n.includes('livre')) return 'book'
  if (n.includes('aliment')) return 'cart'
  if (n.includes('beaut')) return 'palette'
  if (n.includes('num')) return 'code'
  if (n.includes('cours')) return 'school'
  return 'bag'
}

const field = 'w-full rounded-xl border border-line bg-soft px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15'

export default function Market() {
  const photos = useBackgrounds()
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
  const reset = () => { setQ(''); setCat(''); setCond(''); setMin(''); setMax(''); setSort('') }

  const filters = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-semibold text-muted">Prix min<input className={`${field} mt-1`} inputMode="numeric" placeholder="0" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} /></label>
        <label className="text-xs font-semibold text-muted">Prix max<input className={`${field} mt-1`} inputMode="numeric" placeholder="FCFA" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} /></label>
      </div>
      <fieldset><legend className="mb-1.5 text-xs font-semibold text-muted">État</legend>
        <div className="flex gap-2" role="radiogroup">
          {([['', 'Tous'], ['new', 'Neuf'], ['used', 'Occasion']] as const).map(([v, l]) => (
            <button key={v} role="radio" aria-checked={cond === v} onClick={() => setCond(v)} className={`flex-1 rounded-xl border-2 py-2 text-xs font-bold ${cond === v ? 'border-primary bg-primary/10 text-link' : 'border-line text-muted'}`}>{l}</button>
          ))}
        </div></fieldset>
      <label className="block text-xs font-semibold text-muted">Trier par
        <select className={`${field} mt-1`} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="">Plus récentes</option><option value="price_asc">Prix croissant</option><option value="price_desc">Prix décroissant</option>
        </select></label>
      {filtered && <button onClick={reset} className="w-full rounded-xl bg-soft py-2 text-sm font-semibold text-link">Réinitialiser</button>}
    </div>
  )

  return (
    <div className="space-y-5 pt-2">
      {/* hero + search */}
      <header className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg"
        style={{ backgroundImage: photos ? "linear-gradient(110deg, rgb(24 10 70 / .92), rgb(91 33 182 / .55)), url('/img/classroom.jpg')" : 'linear-gradient(110deg, rgb(24 10 70), rgb(91 33 182))', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="flex items-start justify-between gap-3">
          <div><h1 className="text-2xl font-black leading-tight">Marketplace</h1><p className="text-sm text-white/85">Achète et vends entre étudiants du campus</p></div>
          <Link to="/marketplace/mes-annonces" className="shrink-0 rounded-full bg-white/20 px-3.5 py-2 text-xs font-bold backdrop-blur">Mon espace</Link>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-white px-4 text-slate-900 shadow-lg">
            <Icon name="search" size={20} className="text-slate-500" />
            <input className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-slate-500" placeholder="Que cherches-tu ? (sac, livre, cours…)" aria-label="Rechercher une annonce" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters} className="flex items-center gap-1.5 rounded-2xl bg-white/20 px-4 py-3 text-sm font-bold backdrop-blur lg:hidden"><Icon name="filter" size={18} /> Filtres</button>
        </div>
      </header>

      {showFilters && <div className="card p-4 lg:hidden">{filters}</div>}

      {/* categories */}
      <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0" role="tablist" aria-label="Catégories">
        {[{ id: 0, name: 'Tout' }, ...cats].map((c) => {
          const on = String(c.id || '') === cat
          return (
            <button key={c.id} role="tab" aria-selected={on} onClick={() => setCat(c.id ? String(c.id) : '')}
              className={`flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold transition ${on ? 'border-transparent bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-md shadow-primary/30' : 'border-line bg-card text-fg'}`}>
              <Icon name={c.id ? catIcon(c.name) : 'fire'} bold={on} size={18} />{c.name}
            </button>
          )
        })}
      </div>

      <div className="lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <aside className="card sticky top-20 hidden p-4 lg:block" aria-label="Filtres"><h2 className="mb-3 flex items-center gap-2 font-bold"><Icon name="filter" size={18} /> Filtres</h2>{filters}</aside>

        <div className="space-y-6">
          {!filtered && hl && (hl.deals.length > 0 || hl.seller_of_week) && (
            <section className="space-y-3">
              {hl.deals.length > 0 && (
                <>
                  <h2 className="flex items-center gap-2 text-lg font-extrabold">Bons plans du campus <Icon name="fire" bold size={20} className="text-amber-500" /></h2>
                  <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0">
                    {hl.deals.map((l) => <div key={l.id} className="w-44 shrink-0"><ListingCard l={l} compact /></div>)}
                  </div>
                </>
              )}
              {hl.seller_of_week && (
                <Link to={`/u/${hl.seller_of_week.username}`} className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-100 to-fuchsia-100 p-3 text-slate-900 dark:from-amber-400/20 dark:to-fuchsia-500/20 dark:text-white">
                  <span className="rounded-full ring-2 ring-amber-400"><Avatar user={hl.seller_of_week} size={48} /></span>
                  <div className="flex-1"><p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300"><Icon name="crown" bold size={14} /> Vendeur de la semaine</p>
                    <p className="font-bold">{hl.seller_of_week.first_name} {hl.seller_of_week.last_name}</p></div>
                  <span className="text-sm font-semibold">{hl.seller_of_week.rating.avg ? <span className="flex items-center gap-1"><Icon name="star" bold size={16} className="text-amber-500" />{hl.seller_of_week.rating.avg}</span> : 'Nouveau'}</span>
                </Link>
              )}
            </section>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">{filtered ? 'Résultats' : 'Toutes les annonces'}</h2>{!loading && <span className="text-xs text-muted">{items.length}{next ? '+' : ''} annonce{items.length > 1 ? 's' : ''}</span>}</div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">{items.map((l) => <ListingCard key={l.id} l={l} />)}</div>
            {loading && <div className="py-6"><Spinner /></div>}
            <ErrorBox>{err}</ErrorBox>
            {!loading && !err && items.length === 0 && (
              <div className="rounded-2xl border border-dashed border-line py-12 text-center">
                <Icon name="shop" size={40} className="mx-auto text-muted" />
                <p className="mt-2 font-semibold">{filtered ? 'Aucun résultat pour ces filtres.' : "Aucune annonce pour l'instant."}</p>
                <p className="text-sm text-muted">{filtered ? "Essaie d'élargir ta recherche." : 'Sois le premier à vendre !'}</p>
              </div>
            )}
            {next && !loading && <button className="btn-outline" onClick={() => load(next, false)}>Voir plus</button>}
          </section>
        </div>
      </div>

      <Link to="/marketplace/nouveau" aria-label="Vendre un article"
        className="fixed bottom-6 right-4 z-10 flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-5 py-3.5 text-sm font-bold text-white shadow-xl shadow-primary/40 lg:right-10"><Icon name="add2" bold size={20} /> Vendre</Link>
    </div>
  )
}
