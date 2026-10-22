import { useEffect, useState } from 'react'
import Icon from '../components/Icon'
import { Link } from 'react-router-dom'
import { api, ApiError, type PublicUser } from '../api'
import PostList from '../components/PostList'
import { useAuth } from '../auth'
import { Img } from '../dataMode'
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
  const [photoErr, setPhotoErr] = useState('')
  const [busyPhoto, setBusyPhoto] = useState(false)
  if (!user) return null

  async function sendPhoto(field: 'avatar' | 'cover', file?: File) {
    if (!file) return
    const fd = new FormData(); fd.append(field, file)
    setPhotoErr(''); setBusyPhoto(true)
    try { await update(fd) } catch (x) { setPhotoErr(x instanceof ApiError ? (x.data?.[field] ? [x.data[field]].flat().join(' ') : x.text) : 'Envoi impossible.') } finally { setBusyPhoto(false) }
  }
  async function removePhoto(field: 'avatar' | 'cover') {
    const fd = new FormData(); fd.append(`remove_${field}`, 'true')
    await update(fd)
  }

  async function deleteAccount() {
    if (!confirm('Supprimer définitivement ton compte ? Cette action est irréversible.')) return
    const password = prompt('Confirme avec ton mot de passe')
    if (!password) return
    try { await api('/auth/me/', { method: 'DELETE', body: { password } }); await logout() }
    catch { alert('Mot de passe incorrect.') }
  }

  return (
    <div className="space-y-6 pt-6">
      <section className="-mx-4 -mt-6 bg-card pb-4">
        <div className="relative aspect-[3/1] w-full bg-gradient-to-br from-primary/50 to-accent/30">
          {user.cover && <Img src={user.cover} className="h-full w-full object-cover" loadLabel="Afficher la couverture" />}
          <label className="absolute bottom-2 right-2 flex cursor-pointer items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white">
            <Icon name="camera" size={16} /> {user.cover ? 'Changer' : 'Ajouter une couverture'}
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { sendPhoto('cover', e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </div>
        <div className="-mt-12 px-4">
          <div className="relative w-fit">
            <span className="block rounded-full border-4 border-card"><Avatar user={user} size={96} /></span>
            <label className="absolute bottom-0 right-0 grid h-9 w-9 cursor-pointer place-items-center rounded-full border-2 border-card bg-soft" aria-label="Changer la photo de profil">
              <Icon name="camera" bold size={18} />
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { sendPhoto('avatar', e.target.files?.[0]); e.target.value = '' }} />
            </label>
          </div>
          <div className="mt-2">
            <h1 className="text-xl font-bold leading-tight">{user.first_name} {user.last_name}</h1>
            <p className="text-sm text-muted">@{user.username} · {user.field_of_study} · {user.promotion}</p>
            <p className={`text-xs font-semibold ${user.verification === 'verified' ? 'text-accent' : 'text-muted'}`}>{BADGE[user.verification]}</p>
          </div>
        </div>
        <div className="mt-3 flex gap-4 px-4 text-xs">
          {user.avatar && <button className="text-danger" onClick={() => removePhoto('avatar')}>Retirer la photo de profil</button>}
          {user.cover && <button className="text-danger" onClick={() => removePhoto('cover')}>Retirer la couverture</button>}
        </div>
        {photoErr && <p role="alert" className="mx-4 mt-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{photoErr}</p>}
        {busyPhoto && <p role="status" className="mx-4 mt-2 text-xs text-muted">Envoi de la photo…</p>}
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
