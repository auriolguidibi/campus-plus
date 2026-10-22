import { useCallback, useEffect, useState } from 'react'
import Icon from '../components/Icon'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { api, type Profile, type Relation } from '../api'
import PostList from '../components/PostList'
import ReportButton from '../components/ReportButton'
import { MessageButton } from './Search'
import { Img } from '../dataMode'
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
      <button onClick={() => nav(-1)} className="inline-flex items-center gap-1 text-sm font-semibold text-link"><Icon name="back" size={18} /> Retour</button>
      <section className="-mx-4 -mt-6 bg-card pb-4">
        <div className="aspect-[3/1] w-full overflow-hidden bg-gradient-to-br from-primary/50 to-accent/30">
          {p.cover && <Img src={p.cover} className="h-full w-full object-cover" loadLabel="Afficher la couverture" />}
        </div>
        <div className="-mt-10 px-4">
          <span className="rounded-full border-4 border-card"><Avatar user={p} size={84} /></span>
          <div className="mt-2">
            <h1 className="text-xl font-bold leading-tight">{p.first_name} {p.last_name}</h1>
            <p className="text-sm text-muted">@{p.username} · {p.field_of_study} · {p.promotion}</p>
          </div>
        </div>
        <p className="mt-2 px-4 text-sm text-muted">{p.school}</p>
      </section>
      {p.bio && <p className="text-sm">{p.bio}</p>}
      <div className="card grid grid-cols-2 py-3 text-center">
        <div><b className="block text-lg">{p.friends_count}</b><span className="text-xs text-muted">Amis</span></div>
        <div><b className="block text-lg">{p.posts_count}</b><span className="text-xs text-muted">Publications</span></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <MessageButton id={p.id} className="!px-5 !py-3.5" />
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
