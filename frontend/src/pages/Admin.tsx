import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import { ErrorBox, Spinner } from '../components/ui'

type Tab = 'stats' | 'reports' | 'listings' | 'users' | 'content' | 'categories' | 'audit'
const ask = (q: string) => { const v = prompt(q); return v === null ? null : v.trim() }

function useLoad<T>(path: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [err, setErr] = useState('')
  const load = useCallback(() => { api<T>(path).then(setData).catch((x) => setErr(x instanceof ApiError ? (x.data?.detail ?? 'Erreur') : 'Serveur injoignable.')) }, [path])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setData(null); load() }, [load, ...deps])  // eslint-disable-line react-hooks/exhaustive-deps
  return { data, err, load, setErr }
}
async function act(fn: () => Promise<unknown>, done: () => void, fail: (m: string) => void) {
  try { await fn(); done() } catch (x) { fail(x instanceof ApiError ? (x.data?.detail ?? x.text) : 'Erreur') }
}

function Stats() {
  const { data } = useLoad<any>('/admin/stats/')
  if (!data) return <Spinner />
  const tile = (label: string, n: number, warn = false) => <div key={label} className={`card p-3 text-center ${warn && n > 0 ? 'border-danger' : ''}`}><b className="block text-2xl">{n}</b><span className="text-xs text-muted">{label}</span></div>
  return (
    <div className="grid grid-cols-2 gap-3">
      {tile('Utilisateurs actifs', data.users.total)}{tile('Vérifications en attente', data.users.pending, true)}{tile('Comptes suspendus', data.users.suspended)}
      {tile('Publications', data.content.posts)}{tile('Communautés', data.content.communities)}{tile('Annonces publiées', data.content.listings_published)}
      {tile('Annonces à modérer', data.content.listings_pending, true)}{tile('Signalements ouverts', data.moderation.reports_open, true)}{tile('Confessions à modérer', data.moderation.confessions_waiting, true)}
      <p className="col-span-2 text-xs text-muted">Statistiques agrégées uniquement.</p>
    </div>
  )
}

function Reports() {
  const { data, err, load, setErr } = useLoad<any[]>('/admin/reports/')
  const { user } = useAuth()
  async function resolve(id: number, action: string) {
    const note = action === 'dismiss' ? '' : ask('Motif (obligatoire, journalisé)')
    if (note === null || (action !== 'dismiss' && !note)) return
    await act(() => api(`/admin/reports/${id}/resolve/`, { body: { action, note } }), load, setErr)
  }
  if (!data) return err ? <ErrorBox>{err}</ErrorBox> : <Spinner />
  return (
    <div className="space-y-3">
      <ErrorBox>{err}</ErrorBox>
      {data.length === 0 && <p className="py-6 text-center text-sm text-muted">Aucun signalement à traiter.</p>}
      {data.map((r) => (
        <div key={r.id} className="card space-y-2 p-3 text-sm">
          <p><b>{r.target_type}</b> #{r.target_id} · {r.reason_label}{r.others > 0 && <span className="text-danger"> · +{r.others} autre{r.others > 1 ? 's' : ''}</span>}</p>
          <p className="rounded-lg bg-soft p-2">{r.target.summary}{r.target.author && <span className="text-xs text-muted"> — @{r.target.author}</span>}</p>
          {r.details && <p className="text-xs text-muted">« {r.details} » (par @{r.reporter})</p>}
          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg border border-line px-3 py-1.5 text-xs" onClick={() => resolve(r.id, 'dismiss')}>Classer sans suite</button>
            {r.target_type !== 'user' && <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg" onClick={() => resolve(r.id, 'remove')}>Retirer le contenu</button>}
            {user?.staff_role === 'admin' && <button className="rounded-lg border border-line px-3 py-1.5 text-xs text-danger" onClick={() => resolve(r.id, 'suspend_author')}>Suspendre l'auteur</button>}
          </div>
        </div>
      ))}
    </div>
  )
}

function Listings() {
  const { data, err, load, setErr } = useLoad<any[]>('/admin/listings/?status=pending')
  async function decide(id: number, decision: string) {
    const note = decision === 'reject' ? ask('Motif du refus') : ''
    if (note === null || (decision === 'reject' && !note)) return
    await act(() => api(`/admin/listings/${id}/`, { body: { decision, note } }), load, setErr)
  }
  if (!data) return <Spinner />
  return (
    <div className="space-y-3"><ErrorBox>{err}</ErrorBox>
      {data.length === 0 && <p className="py-6 text-center text-sm text-muted">Aucune annonce en attente.</p>}
      {data.map((l) => (
        <div key={l.id} className="card space-y-1 p-3 text-sm">
          <p className="font-semibold">{l.title} · {l.price.toLocaleString('fr-FR')} FCFA</p>
          <p className="text-xs text-muted">{l.category} · @{l.seller}</p><p>{l.description}</p>
          <div className="flex gap-2 pt-1">
            <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg" onClick={() => decide(l.id, 'approve')}>Publier</button>
            <button className="rounded-lg border border-line px-3 py-1.5 text-xs text-danger" onClick={() => decide(l.id, 'reject')}>Refuser</button>
            <Link to={`/marketplace/${l.id}`} className="px-2 py-1.5 text-xs text-primary">Voir</Link>
          </div>
        </div>
      ))}
    </div>
  )
}

function Users() {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [f, setF] = useState('')
  const { data, err, load, setErr } = useLoad<any[]>(`/admin/users/?q=${encodeURIComponent(q)}${f ? `&${f}` : ''}`, [])
  const isAdmin = user?.staff_role === 'admin'
  const post = (id: number, path: string, body: object) => act(() => api(`/admin/users/${id}/${path}/`, { body }), load, setErr)
  async function suspend(id: number) { const reason = ask('Motif de la suspension (obligatoire)'); if (reason) await post(id, 'suspend', { action: 'suspend', reason }) }
  async function role(id: number) { const r = ask('Nouveau rôle : user, moderator ou admin'); if (r) await post(id, 'role', { role: r }) }
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input className="field" placeholder="Rechercher (pseudo, nom, e-mail)…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="field !w-auto" value={f} onChange={(e) => setF(e.target.value)} aria-label="Filtre">
          <option value="">Tous</option><option value="verification=pending">À vérifier</option><option value="active=0">Suspendus</option>
        </select>
      </div>
      <ErrorBox>{err}</ErrorBox>
      {!data ? <Spinner /> : data.map((u) => (
        <div key={u.id} className="card space-y-1 p-3 text-sm">
          <p><b>@{u.username}</b> {u.name && `· ${u.name}`} <span className="text-xs text-muted">· {u.role}</span></p>
          <p className="text-xs text-muted">{u.school} · {u.field_of_study} · {u.promotion}{u.email && ` · ${u.email}`}</p>
          <p className="text-xs">Vérification : <b>{u.verification}</b>{!u.is_active && <span className="text-danger"> · suspendu{u.suspension_reason && ` (${u.suspension_reason})`}</span>}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {u.verification !== 'verified' && <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg" onClick={() => post(u.id, 'verify', { decision: 'verified' })}>Vérifier</button>}
            {u.verification === 'pending' && <button className="rounded-lg border border-line px-3 py-1.5 text-xs" onClick={() => post(u.id, 'verify', { decision: 'rejected' })}>Refuser</button>}
            {isAdmin && u.id !== user?.id && (u.is_active
              ? <button className="rounded-lg border border-line px-3 py-1.5 text-xs text-danger" onClick={() => suspend(u.id)}>Suspendre</button>
              : <button className="rounded-lg border border-line px-3 py-1.5 text-xs" onClick={() => post(u.id, 'suspend', { action: 'reactivate' })}>Réactiver</button>)}
            {isAdmin && u.id !== user?.id && <button className="rounded-lg border border-line px-3 py-1.5 text-xs" onClick={() => role(u.id)}>Changer le rôle</button>}
          </div>
        </div>
      ))}
    </div>
  )
}

function Content() {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const posts = useLoad<any[]>(`/admin/posts/?q=${encodeURIComponent(q)}`)
  const comms = useLoad<any[]>('/admin/communities/')
  async function removePost(id: number) { const note = ask('Motif (obligatoire)'); if (note) await act(() => api(`/admin/posts/${id}/remove/`, { method: 'POST', body: { note } }), posts.load, posts.setErr) }
  async function delComm(id: number) { if (confirm('Supprimer cette communauté et ses publications ?')) await act(() => api(`/admin/communities/${id}/`, { method: 'DELETE' }), comms.load, comms.setErr) }
  return (
    <div className="space-y-4">
      <input className="field" placeholder="Rechercher une publication ou un auteur…" value={q} onChange={(e) => setQ(e.target.value)} />
      <ErrorBox>{posts.err || comms.err}</ErrorBox>
      {(posts.data ?? []).map((p) => (
        <div key={p.id} className="card flex items-start gap-2 p-3 text-sm"><div className="flex-1"><p>{p.text}</p><p className="text-xs text-muted">@{p.author}</p></div>
          <button className="text-xs text-danger" onClick={() => removePost(p.id)}>Retirer</button></div>
      ))}
      <h2 className="font-semibold">Communautés</h2>
      {(comms.data ?? []).map((c) => (
        <div key={c.id} className="card flex items-center gap-2 p-3 text-sm"><Link to={`/communautes/${c.id}`} className="flex-1">{c.name} <span className="text-xs text-muted">· {c.members} membres</span></Link>
          {user?.staff_role === 'admin' && <button className="text-xs text-danger" onClick={() => delComm(c.id)}>Supprimer</button>}</div>
      ))}
      <Link to="/confessions" className="card block p-3 text-sm font-semibold text-primary">Modération des confessions →</Link>
    </div>
  )
}

function Categories() {
  const { data, err, load, setErr } = useLoad<any[]>('/admin/categories/')
  const [name, setName] = useState('')
  if (!data) return <Spinner />
  return (
    <div className="space-y-3">
      <ErrorBox>{err}</ErrorBox>
      <div className="flex gap-2"><input className="field" placeholder="Nouvelle catégorie" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <button className="rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg" disabled={!name.trim()} onClick={() => act(() => api('/admin/categories/', { body: { name } }), () => { setName(''); load() }, setErr)}>Ajouter</button></div>
      {data.map((c) => (
        <div key={c.id} className="card flex items-center justify-between p-3 text-sm"><span className={c.is_active ? '' : 'text-muted line-through'}>{c.name}</span>
          <button className="text-xs text-primary" onClick={() => act(() => api(`/admin/categories/${c.id}/`, { method: 'PATCH', body: { is_active: !c.is_active } }), load, setErr)}>{c.is_active ? 'Désactiver' : 'Activer'}</button></div>
      ))}
    </div>
  )
}

function Audit() {
  const { data, err } = useLoad<any[]>('/admin/audit-log/')
  if (!data) return err ? <ErrorBox>{err}</ErrorBox> : <Spinner />
  return (
    <div className="card divide-y divide-line px-3 text-xs">
      {data.length === 0 && <p className="py-4 text-center text-muted">Journal vide.</p>}
      {data.map((e) => (
        <div key={e.id} className="py-2"><p><b>{e.action}</b> · {e.target_type}{e.target_id !== null && ` #${e.target_id}`} · par @{e.actor}</p>
          <p className="text-muted">{new Date(e.created_at).toLocaleString('fr-FR')}{e.ip && ` · ${e.ip}`}{Object.keys(e.detail).length > 0 && ` · ${JSON.stringify(e.detail)}`}</p></div>
      ))}
    </div>
  )
}

export default function Admin() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('stats')
  if (!user || user.staff_role === 'user') return <Navigate to="/" replace />  // UI guard only: every endpoint re-checks the role server-side
  const admin = user.staff_role === 'admin'
  const tabs: [Tab, string][] = [['stats', 'Tableau de bord'], ['reports', 'Signalements'], ['listings', 'Annonces'], ['users', 'Utilisateurs'], ['content', 'Contenus'],
    ...(admin ? [['categories', 'Catégories'], ['audit', 'Journal']] as [Tab, string][] : [])]
  return (
    <div className="space-y-4 pt-6">
      <div><h1 className="text-2xl font-bold">Administration</h1><p className="text-xs text-muted">Rôle : {admin ? 'administrateur' : 'modérateur'} · actions sensibles journalisées</p></div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {tabs.map(([v, l]) => <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${tab === v ? 'bg-primary text-primary-fg' : 'bg-soft text-muted'}`}>{l}</button>)}
      </div>
      {tab === 'stats' && <Stats />}{tab === 'reports' && <Reports />}{tab === 'listings' && <Listings />}
      {tab === 'users' && <Users />}{tab === 'content' && <Content />}{tab === 'categories' && <Categories />}{tab === 'audit' && <Audit />}
    </div>
  )
}
