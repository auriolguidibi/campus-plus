import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type Community, type Member, type Role } from '../api'
import PostList from '../components/PostList'
import { Avatar, Spinner } from '../components/ui'
import { CATEGORIES } from './Communities'

const ROLE: Record<Role, string> = { creator: 'Créateur', admin: 'Administrateur', moderator: 'Modérateur', member: 'Membre' }

export default function CommunityPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const [c, setC] = useState<Community | null>(null)
  const [missing, setMissing] = useState(false)
  const [tab, setTab] = useState<'posts' | 'members' | 'rules'>('posts')
  const [members, setMembers] = useState<Member[] | null>(null)

  const load = useCallback(() => { api<Community>(`/communities/${id}/`).then(setC).catch(() => setMissing(true)) }, [id])
  useEffect(load, [load])
  useEffect(() => { if (tab === 'members') api<Member[]>(`/communities/${id}/members/`).then(setMembers) }, [tab, id])

  if (missing) return <p className="pt-10 text-center text-muted">Communauté introuvable.</p>
  if (!c) return <div className="py-10"><Spinner /></div>
  const manager = c.my_role === 'creator' || c.my_role === 'admin'
  const staff = manager || c.my_role === 'moderator'

  async function setRole(uid: number, role: string) {
    await api(`/communities/${id}/members/${uid}/role/`, { body: { role } })
    setMembers(await api<Member[]>(`/communities/${id}/members/`))
  }
  async function kick(uid: number) {
    if (!confirm('Retirer ce membre ?')) return
    await api(`/communities/${id}/members/${uid}/remove/`, { method: 'POST' })
    setMembers(await api<Member[]>(`/communities/${id}/members/`)); load()
  }
  async function leave() {
    if (!confirm('Quitter cette communauté ?')) return
    await api(`/communities/${id}/leave/`, { method: 'POST' }); load()
  }
  async function remove() {
    if (!confirm('Supprimer définitivement la communauté et ses publications ?')) return
    await api(`/communities/${id}/`, { method: 'DELETE' }); nav('/communautes')
  }

  return (
    <div className="space-y-4 pt-6">
      <Link to="/communautes" className="text-sm text-link">← Communautés</Link>
      <header>
        <h1 className="text-2xl font-bold">{c.name}</h1>
        <p className="text-sm text-muted">{CATEGORIES[c.category]} · {c.member_count} membre{c.member_count > 1 ? 's' : ''}</p>
        {c.description && <p className="mt-2 text-sm">{c.description}</p>}
      </header>
      <div className="flex gap-2">
        {c.my_role ? (
          <>
            <Link to={`/creer?communaute=${c.id}`} className="btn text-center">Publier</Link>
            {c.my_role !== 'creator' && <button className="btn-outline" onClick={leave}>Quitter</button>}
          </>
        ) : <button className="btn" onClick={async () => { await api(`/communities/${id}/join/`, { method: 'POST' }); load() }}>Rejoindre</button>}
      </div>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-soft p-1" role="tablist">
        {([['posts', 'Publications'], ['members', 'Membres'], ['rules', 'Règles']] as const).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
            className={`rounded-lg py-2 text-xs font-semibold ${tab === v ? 'bg-primary text-primary-fg' : 'text-muted'}`}>{l}</button>
        ))}
      </div>
      {tab === 'posts' && <PostList query={`community=${c.id}`} empty="Aucune publication dans ce groupe." />}
      {tab === 'rules' && <p className="card whitespace-pre-wrap p-4 text-sm">{c.rules || "Cette communauté n'a pas défini de règles."}</p>}
      {tab === 'members' && (members === null ? <Spinner /> : (
        <div className="card divide-y divide-line px-4">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2">
              <Link to={`/u/${m.username}`}><Avatar user={m} size={36} /></Link>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{m.first_name} {m.last_name}</p>
                <p className="text-xs text-muted">{ROLE[m.role]}</p>
              </div>
              {manager && m.role !== 'creator' && (
                <select aria-label="Rôle" className="rounded-lg border border-line bg-soft px-1 py-1 text-xs" value={m.role} onChange={(e) => setRole(m.id, e.target.value)}>
                  <option value="member">Membre</option><option value="moderator">Modérateur</option><option value="admin">Administrateur</option>
                </select>
              )}
              {staff && m.role !== 'creator' && (c.my_role === 'creator' || (m.role !== 'admin')) && (
                <button className="text-xs text-danger" onClick={() => kick(m.id)}>Retirer</button>
              )}
            </div>
          ))}
        </div>
      ))}
      {c.my_role === 'creator' && <button className="w-full py-2 text-sm text-danger" onClick={remove}>Supprimer la communauté</button>}
    </div>
  )
}
