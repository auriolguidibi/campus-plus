import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError, type Community, type Page } from '../api'
import { ErrorBox, Spinner } from '../components/ui'

export const CATEGORIES: Record<string, string> = {
  filiere: 'Filière', promotion: 'Promotion', classe: 'Classe', club: 'Club', projet: 'Projet', interet: "Centre d'intérêt",
}

function CommunityRow({ c, onJoin }: { c: Community; onJoin?: () => void }) {
  return (
    <div className="card flex items-center gap-3 p-3">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-lg font-bold text-primary">{c.name.charAt(0).toUpperCase()}</div>
      <Link to={`/communautes/${c.id}`} className="min-w-0 flex-1">
        <p className="truncate font-semibold">{c.name}</p>
        <p className="truncate text-xs text-muted">{CATEGORIES[c.category]} · {c.member_count} membre{c.member_count > 1 ? 's' : ''}</p>
      </Link>
      {onJoin && <button onClick={onJoin} className="rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary">Rejoindre</button>}
    </div>
  )
}

function NewCommunity({ onDone }: { onDone: () => void }) {
  const nav = useNavigate()
  const [err, setErr] = useState('')
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.currentTarget))
    try { const c = await api<Community>('/communities/', { body: data }); onDone(); nav(`/communautes/${c.id}`) }
    catch (x) { setErr(x instanceof ApiError ? (x.data?.detail ?? x.text) : 'Serveur injoignable.') }
  }
  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <input name="name" className="field" placeholder="Nom de la communauté" maxLength={80} required />
      <select name="category" className="field" defaultValue="interet">
        {Object.entries(CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <textarea name="description" className="field" placeholder="Description" maxLength={500} />
      <textarea name="rules" className="field" placeholder="Règles de la communauté" maxLength={2000} />
      <ErrorBox>{err}</ErrorBox>
      <button className="btn">Créer</button>
    </form>
  )
}

export default function Communities() {
  const [tab, setTab] = useState<'mine' | 'discover'>('mine')
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Community[] | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => {
    setItems(null)
    api<Page<Community>>(`/communities/?scope=${tab}&q=${encodeURIComponent(q.trim())}`).then((p) => setItems(p.results)).catch(() => setItems([]))
  }, [tab, q])
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])

  async function join(id: number) { await api(`/communities/${id}/join/`, { method: 'POST' }); load() }

  return (
    <div className="space-y-4 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Communautés</h1>
        <button className="text-sm font-semibold text-primary" onClick={() => setCreating(!creating)}>{creating ? 'Fermer' : '+ Créer'}</button>
      </div>
      {creating && <NewCommunity onDone={() => setCreating(false)} />}
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-soft p-1" role="tablist">
        {([['mine', 'Mes groupes'], ['discover', 'Découvrir']] as const).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
            className={`rounded-lg py-2 text-sm font-semibold ${tab === v ? 'bg-primary text-primary-fg' : 'text-muted'}`}>{l}</button>
        ))}
      </div>
      <input className="field" placeholder="Rechercher une communauté…" value={q} onChange={(e) => setQ(e.target.value)} />
      {items === null ? <Spinner /> : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">{tab === 'mine' ? "Tu n'as rejoint aucun groupe. Va dans « Découvrir »." : 'Aucune communauté trouvée.'}</p>
      ) : (
        <div className="space-y-3">{items.map((c) => <CommunityRow key={c.id} c={c} onJoin={tab === 'discover' ? () => join(c.id) : undefined} />)}</div>
      )}
    </div>
  )
}
