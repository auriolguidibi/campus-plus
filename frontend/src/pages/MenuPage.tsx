import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import Icon from '../components/Icon'
import { Avatar } from '../components/ui'
import { useDataMode } from '../dataMode'
import type { IconName } from '../icons'
import { useTheme, type ThemeMode } from '../theme'

const SHORTCUTS: [string, IconName, string][] = [
  ['/amis', 'users', 'Amis'], ['/communautes', 'users', 'Communautés'], ['/marketplace', 'shop', 'Marketplace'], ['/defis', 'trophy', 'Défis & Battles'],
  ['/confessions', 'ghost', 'Confessions'], ['/evenements', 'calendar', 'Événements'], ['/classement', 'ranking', 'Classement'], ['/marketplace/mes-annonces', 'bag', 'Mon espace vendeur'],
]
const MODES: [ThemeMode, string][] = [['light', 'Clair'], ['dark', 'Sombre'], ['auto', 'Auto']]

export default function MenuPage() {
  const { user, logout, saveTheme } = useAuth()
  const { mode } = useTheme()
  const { free, setFree } = useDataMode()
  if (!user) return null
  return (
    <div className="space-y-4 pt-6">
      <h1 className="text-2xl font-bold">Menu</h1>
      <Link to="/profil" className="card flex items-center gap-3 p-3">
        <Avatar user={user} size={52} />
        <span className="flex-1"><b className="block">{user.first_name} {user.last_name}</b><span className="text-sm text-muted">Voir ton profil</span></span>
        <Icon name="next" size={20} />
      </Link>

      <div className="grid grid-cols-2 gap-3">
        {SHORTCUTS.map(([to, icon, label]) => (
          <Link key={to} to={to} className="card flex flex-col gap-2 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-link"><Icon name={icon} bold size={24} /></span>
            <span className="text-sm font-bold">{label}</span>
          </Link>
        ))}
      </div>

      <section className="card divide-y divide-line">
        <label className="flex items-center justify-between gap-3 p-4">
          <span><b className="block text-sm">Mode gratuit</b><span className="text-xs text-muted">Économise tes données : les photos se chargent au toucher.</span></span>
          <input type="checkbox" role="switch" checked={free} onChange={(e) => setFree(e.target.checked)} className="h-6 w-11 shrink-0 accent-primary" />
        </label>
        <div className="space-y-2 p-4">
          <b className="block text-sm">Apparence</b>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Thème">
            {MODES.map(([m, l]) => (
              <button key={m} role="radio" aria-checked={mode === m} onClick={() => saveTheme(m)}
                className={`rounded-xl border-2 py-2 text-sm font-semibold ${mode === m ? 'border-primary bg-primary/10 text-link' : 'border-line text-muted'}`}>{l}</button>
            ))}
          </div>
        </div>
        <Link to="/notifications" className="flex items-center justify-between p-4 text-sm font-semibold"><span className="flex items-center gap-2"><Icon name="bell" size={20} /> Notifications et préférences</span><Icon name="next" size={18} /></Link>
        {user.staff_role !== 'user' && <Link to="/admin" className="flex items-center justify-between p-4 text-sm font-semibold text-link"><span className="flex items-center gap-2"><Icon name="shield" size={20} /> Espace {user.staff_role === 'admin' ? 'administrateur' : 'modérateur'}</span><Icon name="next" size={18} /></Link>}
      </section>

      <button className="btn-outline flex items-center justify-center gap-2" onClick={logout}><Icon name="logout" size={20} /> Déconnexion</button>
    </div>
  )
}
