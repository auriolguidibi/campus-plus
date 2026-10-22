import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { api, type Profile, type Relation } from '../api'
import PostList from '../components/PostList'
import ReportButton from '../components/ReportButton'
import { Avatar, ErrorBox, Spinner } from '../components/ui'

export default function UserProfile() {
  const { username = '' } = useParams()
  const nav = useNavigate()
  const [p, setP] = useState<Profile | null>(null)
  const [missing, setMissing] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    api<Profile>(`/users/${username}/`).then(setP).catch(() => setMissing(true))
  }, [username])
  useEffect(() => { setP(null); setMissing(false); load() }, [load])

  if (missing) return <p className="pt-10 text-center text-muted">Profil introuvable.</p>
  if (!p) return <div className="py-10"><Spinner /></div>
  if (p.relation === 'self') return <Navigate to="/profil" replace />

  async function act(action: string, method = 'POST') {
    setErr('')
    try { await api(`/friends/${action}/${p!.id}/`, { method }); load() } catch { setErr('Action impossible.') }
  }
  async function block() {
    if (!confirm(`Bloquer ${p!.username} ? Vous ne verrez plus vos contenus respectifs.`)) return
    await api(`/blocks/${p!.id}/`, { method: 'POST' }); nav('/')
  }

  const buttons: Record<Relation, [string, () => void, boolean?][]> = {
    self: [],
    none: [['Ajouter', () => act('request')]],
    request_sent: [['Demande envoyée · Annuler', () => act('decline'), true]],
    request_received: [['Accepter', () => act('accept')], ['Refuser', () => act('decline'), true]],
    friends: [['Ami · Retirer', () => { if (confirm('Retirer cet ami ?')) act('remove', 'DELETE') }, true]],
  }

  return (
    <div className="space-y-5 pt-6">
      <button onClick={() => nav(-1)} className="text-sm text-link">← Retour</button>
      <section className="flex items-center gap-4">
        <Avatar user={p} size={72} />
        <div>
          <h1 className="text-xl font-bold">{p.first_name} {p.last_name}</h1>
          <p className="text-sm text-muted">@{p.username}</p>
          <p className="text-sm text-muted">{p.field_of_study} · {p.promotion} · {p.school}</p>
        </div>
      </section>
      {p.bio && <p className="text-sm">{p.bio}</p>}
      <div className="card grid grid-cols-2 py-3 text-center">
        <div><b className="block text-lg">{p.friends_count}</b><span className="text-xs text-muted">Amis</span></div>
        <div><b className="block text-lg">{p.posts_count}</b><span className="text-xs text-muted">Publications</span></div>
      </div>
      <div className="flex gap-2">
        {buttons[p.relation].map(([label, fn, outline]) => (
          <button key={label} onClick={fn} className={outline ? 'btn-outline' : 'btn'}>{label}</button>
        ))}
      </div>
      <ErrorBox>{err}</ErrorBox>
      <div className="flex items-center gap-4">
        <button onClick={block} className="text-xs text-danger">Bloquer cet utilisateur</button>
        <ReportButton type="user" id={p.id} label="Signaler cet utilisateur" />
      </div>
      <h2 className="font-semibold">Publications</h2>
      <PostList query={`author=${encodeURIComponent(p.username)}`} empty="Aucune publication." />
      <Link to="/amis" className="block text-center text-sm text-link">Voir mes amis</Link>
    </div>
  )
}
