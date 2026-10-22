import { useEffect, useState } from 'react'
import Icon from '../components/Icon'
import { Link } from 'react-router-dom'
import { api, type PublicUser } from '../api'
import PostList from '../components/PostList'
import { useAuth } from '../auth'
import { Avatar } from '../components/ui'
import { useTheme, type ThemeMode } from '../theme'

const MODES: [ThemeMode, string][] = [['light', 'Clair'], ['dark', 'Sombre'], ['auto', 'Automatique']]
const BADGE: Record<string, string> = { verified: 'Compte vérifié', pending: 'Vérification en attente', rejected: 'Vérification refusée' }

export default function Profile() {
  const { user, logout, saveTheme, update } = useAuth()
  const { mode } = useTheme()
  const [bio, setBio] = useState(user?.bio ?? '')
  const [saved, setSaved] = useState(false)
  const [blocked, setBlocked] = useState<PublicUser[]>([])
  useEffect(() => { api<PublicUser[]>('/blocks/').then(setBlocked).catch(() => {}) }, [])
  if (!user) return null

  async function deleteAccount() {
    if (!confirm('Supprimer définitivement ton compte ? Cette action est irréversible.')) return
    const password = prompt('Confirme avec ton mot de passe')
    if (!password) return
    try { await api('/auth/me/', { method: 'DELETE', body: { password } }); await logout() }
    catch { alert('Mot de passe incorrect.') }
  }

  return (
    <div className="space-y-6 pt-6">
      <section className="flex items-center gap-4">
        <Avatar user={user} size={72} />
        <div>
          <h1 className="text-xl font-bold">{user.first_name} {user.last_name}</h1>
          <p className="text-sm text-muted">@{user.username} · {user.field_of_study} · {user.promotion}</p>
          <p className={`text-xs font-semibold ${user.verification === 'verified' ? 'text-accent' : 'text-muted'}`}>{BADGE[user.verification]}</p>
        </div>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="font-semibold">Biographie</h2>
        <textarea className="field" maxLength={300} value={bio} onChange={(e) => { setBio(e.target.value); setSaved(false) }} />
        <button className="btn" onClick={async () => { await update({ bio }); setSaved(true) }}>{saved ? 'Enregistré' : 'Enregistrer'}</button>
      </section>

      <Link to="/amis" className="card flex items-center justify-between p-4 font-semibold"><span className="flex items-center gap-2"><Icon name="users" size={20} /> Mes amis &amp; demandes</span><Icon name="next" size={18} /></Link>
      {user.staff_role !== 'user' && <Link to="/admin" className="card block bg-primary/10 p-4 font-semibold text-link"><span className="flex items-center justify-between"><span className="flex items-center gap-2"><Icon name="shield" size={20} /> Espace {user.staff_role === 'admin' ? 'administrateur' : 'modérateur'}</span><Icon name="next" size={18} /></span></Link>}

      <section className="space-y-3">
        <h2 className="font-semibold">Mes publications</h2>
        <PostList query={`author=${encodeURIComponent(user.username)}`} empty="Tu n'as encore rien publié." />
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Paramètres · Apparence</h2>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Thème">
          {MODES.map(([m, label]) => (
            <button key={m} role="radio" aria-checked={mode === m} onClick={() => saveTheme(m)}
              className={`rounded-xl border-2 py-3 text-sm font-semibold ${mode === m ? 'border-primary bg-primary/10 text-link' : 'border-line text-muted'}`}>{label}</button>
          ))}
        </div>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="font-semibold">Utilisateurs bloqués</h2>
        {blocked.length === 0 && <p className="text-sm text-muted">Aucun utilisateur bloqué.</p>}
        {blocked.map((b) => (
          <div key={b.id} className="flex items-center justify-between text-sm">
            @{b.username}
            <button className="text-link" onClick={async () => { await api(`/blocks/${b.id}/`, { method: 'DELETE' }); setBlocked(blocked.filter((x) => x.id !== b.id)) }}>Débloquer</button>
          </div>
        ))}
      </section>

      <p className="text-center text-[11px] text-muted">Icônes : Solar (Iconify)</p>

      <section className="space-y-2">
        <button className="btn-outline" onClick={logout}>Déconnexion</button>
        <button className="w-full py-2 text-sm text-danger" onClick={deleteAccount}>Supprimer mon compte</button>
      </section>
    </div>
  )
}
