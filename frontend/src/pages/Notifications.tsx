import { useCallback, useEffect, useState } from 'react'
import Icon from '../components/Icon'
import { useNavigate } from 'react-router-dom'
import { api, type Page } from '../api'
import type { IconName } from '../icons'
import { Spinner, timeAgo } from '../components/ui'

interface Notif { id: number; category: string; text: string; link: string; created_at: string; read: boolean }
interface Pref { category: string; label: string; enabled: boolean; locked: boolean }

const ICON: Record<string, IconName> = { friends: 'userPlus', social: 'chatLine', messages: 'chat', groups: 'users', challenges: 'trophy', events: 'calendar', market: 'shop', system: 'shield' }

export default function Notifications() {
  const nav = useNavigate()
  const [items, setItems] = useState<Notif[] | null>(null)
  const [next, setNext] = useState<string | null>(null)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [prefs, setPrefs] = useState<Pref[] | null>(null)
  const [showPrefs, setShowPrefs] = useState(false)

  const load = useCallback(async (path: string, reset: boolean) => {
    const p = await api<Page<Notif>>(path)
    setItems((old) => (reset || !old ? p.results : [...old, ...p.results.filter((n) => !old.some((o) => o.id === n.id))]))
    setNext(p.next ? p.next.replace(/^.*\/api/, '') : null)
  }, [])
  useEffect(() => { setItems(null); load(`/notifications/${unreadOnly ? '?unread=1' : ''}`, true).catch(() => setItems([])) }, [unreadOnly, load])
  useEffect(() => { if (showPrefs && !prefs) api<Pref[]>('/notifications/preferences/').then(setPrefs) }, [showPrefs, prefs])

  async function open(n: Notif) {
    if (!n.read) { api(`/notifications/${n.id}/read/`, { method: 'POST' }).catch(() => {}); setItems((l) => l?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null) }
    if (n.link) nav(n.link)
  }
  async function readAll() { await api('/notifications/read-all/', { method: 'POST' }); setItems((l) => l?.map((x) => ({ ...x, read: true })) ?? null) }
  async function toggle(p: Pref) {
    const upd = await api<Pref[]>('/notifications/preferences/', { method: 'PUT', body: { [p.category]: !p.enabled } })
    setPrefs(upd)
  }

  return (
    <div className="space-y-4 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <button className="text-sm font-semibold text-link" onClick={() => setShowPrefs(!showPrefs)} aria-expanded={showPrefs}>Préférences</button>
      </div>

      {showPrefs && (
        <section className="card divide-y divide-line px-4" aria-label="Préférences de notification">
          {prefs === null ? <Spinner /> : prefs.map((p) => (
            <label key={p.category} className="flex items-center justify-between py-3 text-sm">
              <span className="flex items-center gap-2"><Icon name={ICON[p.category]} size={20} /> {p.label}{p.locked && <span className="text-xs text-muted"> (toujours actif)</span>}</span>
              <input type="checkbox" checked={p.enabled} disabled={p.locked} onChange={() => toggle(p)} className="h-5 w-5" />
            </label>
          ))}
        </section>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-2" role="tablist">
          {([[false, 'Toutes'], [true, 'Non lues']] as const).map(([v, l]) => (
            <button key={l} role="tab" aria-selected={unreadOnly === v} onClick={() => setUnreadOnly(v)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${unreadOnly === v ? 'bg-primary text-primary-fg' : 'bg-soft text-muted'}`}>{l}</button>
          ))}
        </div>
        <button className="text-xs text-link" onClick={readAll}>Tout marquer comme lu</button>
      </div>

      {items === null ? <Spinner /> : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">{unreadOnly ? 'Rien de nouveau.' : 'Aucune notification pour le moment.'}</p>
      ) : (
        <ul className="card divide-y divide-line">
          {items.map((n) => (
            <li key={n.id}>
              <button onClick={() => open(n)} className={`flex w-full items-start gap-3 px-4 py-3 text-left ${n.read ? '' : 'bg-primary/5'}`}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-link"><Icon name={ICON[n.category]} size={20} /></span>
                <span className="min-w-0 flex-1"><span className={`block text-sm ${n.read ? 'text-muted' : 'font-semibold'}`}>{n.text}</span><span className="text-xs text-muted">{timeAgo(n.created_at)}</span></span>
                {!n.read && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-label="Non lue" />}
              </button>
            </li>
          ))}
        </ul>
      )}
      {next && <button className="btn-outline" onClick={() => load(next, false)}>Voir plus</button>}
    </div>
  )
}
