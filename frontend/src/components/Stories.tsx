import { useCallback, useEffect, useState } from 'react'
import { useDataMode } from '../dataMode'
import Icon from './Icon'
import { api, ApiError, type PublicUser, type StoryGroup } from '../api'
import { useAuth } from '../auth'
import { Avatar, ErrorBox, timeAgo } from './ui'

function remaining(iso: string) {
  const m = Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 60000))
  return m >= 60 ? `${Math.floor(m / 60)} h restantes` : `${m} min restantes`
}

function Viewer({ group, onClose, onSeen }: { group: StoryGroup; onClose: () => void; onSeen: () => void }) {
  const { user } = useAuth()
  const [i, setI] = useState(group.stories.findIndex((s) => !s.seen) === -1 ? 0 : group.stories.findIndex((s) => !s.seen))
  const [stories, setStories] = useState(group.stories)
  const [viewers, setViewers] = useState<PublicUser[] | null>(null)
  const s = stories[i]
  const mine = group.author.id === user?.id

  useEffect(() => {
    setViewers(null)
    if (s && !mine) api(`/stories/${s.id}/view/`, { method: 'POST' }).then(onSeen).catch(() => {})
  }, [s?.id])  // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) return null
  const next = () => (i + 1 < stories.length ? setI(i + 1) : onClose())

  async function remove() {
    if (!confirm('Supprimer cette story ?')) return
    await api(`/stories/${s.id}/`, { method: 'DELETE' })
    const rest = stories.filter((x) => x.id !== s.id)
    if (!rest.length) { onSeen(); onClose(); return }
    setStories(rest); setI(Math.min(i, rest.length - 1)); onSeen()
  }
  async function setVisibility(v: string) {
    const upd = await api<typeof s>(`/stories/${s.id}/`, { method: 'PATCH', body: { visibility: v } })
    setStories(stories.map((x) => (x.id === s.id ? { ...x, visibility: upd.visibility } : x)))
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" role="dialog" aria-label="Story">
      <div className="flex gap-1 px-3 pt-3">{stories.map((x, k) => <span key={x.id} className={`h-1 flex-1 rounded ${k <= i ? 'bg-white' : 'bg-white/30'}`} />)}</div>
      <div className="flex items-center gap-2 px-3 py-2">
        <Avatar user={group.author} size={32} />
        <div className="flex-1 text-sm"><b>{group.author.first_name}</b> <span className="text-white/70">{timeAgo(s.created_at)} · {remaining(s.expires_at)}</span></div>
        <button onClick={onClose} aria-label="Fermer" className="px-2"><Icon name="close" size={28} /></button>
      </div>
      <button className="relative min-h-0 flex-1" onClick={next} aria-label="Story suivante">
        <img src={s.url} alt="" className="h-full w-full object-contain" />
        {s.caption && <span className="absolute inset-x-0 bottom-4 mx-4 rounded-xl bg-black/60 px-3 py-2 text-sm">{s.caption}</span>}
      </button>
      {mine && (
        <div className="space-y-2 bg-black/80 p-3 text-sm">
          {viewers === null
            ? <button onClick={async () => setViewers(await api<PublicUser[]>(`/stories/${s.id}/viewers/`))}className="flex items-center gap-2"><Icon name="eye" size={18} /> Voir les spectateurs</button>
            : <p className="flex items-center gap-2"><Icon name="eye" size={18} /> {viewers.length} spectateur{viewers.length > 1 ? 's' : ''}{viewers.length > 0 && ' : ' + viewers.map((v) => '@' + v.username).join(', ')}</p>}
          <div className="flex items-center gap-3">
            <select aria-label="Visibilité" value={s.visibility} onChange={(e) => setVisibility(e.target.value)} className="rounded-lg bg-white/15 px-2 py-1">
              <option value="everyone">Tout le campus</option><option value="friends">Amis uniquement</option>
            </select>
            <button onClick={remove} className="ml-auto text-red-400">Supprimer</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Stories() {
  const { user } = useAuth()
  const { free } = useDataMode()
  const [groups, setGroups] = useState<StoryGroup[]>([])
  const [open, setOpen] = useState<StoryGroup | null>(null)
  const [vis, setVis] = useState('everyone')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => { api<StoryGroup[]>('/stories/').then(setGroups).catch(() => {}) }, [])
  useEffect(load, [load])

  async function upload(file: File | undefined) {
    if (!file) return
    const caption = prompt('Légende (facultatif)') ?? ''
    const fd = new FormData()
    fd.append('image', file); fd.append('caption', caption); fd.append('visibility', vis)
    setBusy(true); setErr('')
    try { await api('/stories/', { body: fd }); load() } catch (x) { setErr(x instanceof ApiError ? x.text : 'Envoi impossible.') } finally { setBusy(false) }
  }

  const card = 'relative h-[184px] w-[105px] shrink-0 overflow-hidden rounded-xl border border-line bg-soft text-left'
  return (
    <div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden" aria-label="Stories">
        <label className={`${card} flex cursor-pointer flex-col bg-card`}>
          <span className="block h-[132px] w-full overflow-hidden bg-primary/15">
            {user?.avatar && !free ? <img src={user.avatar} alt="" className="h-full w-full object-cover" />
              : <span className="grid h-full place-items-center text-4xl font-bold text-link">{(user?.first_name ?? '?').charAt(0)}</span>}
          </span>
          <span className="absolute left-1/2 top-[118px] grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full border-[3px] border-card bg-primary text-primary-fg">
            {busy ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-fg/40 border-t-primary-fg" /> : <Icon name="add" bold size={20} />}
          </span>
          <span className="mt-auto px-1 pb-2 text-center text-xs font-semibold leading-tight">Créer une story</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        {groups.map((g) => {
          const cover = g.stories[g.stories.length - 1]
          return (
            <button key={g.author.id} onClick={() => setOpen(g)} className={card} aria-label={`Story de ${g.author.first_name}`}>
              {!free ? <img src={cover.url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : <span className="absolute inset-0 bg-gradient-to-br from-primary/60 to-accent/40" />}
              <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/25" />
              <span className={`absolute left-2 top-2 grid h-6 min-w-6 place-items-center rounded-md px-1 text-xs font-bold ${g.all_seen ? 'bg-white/70 text-slate-800' : 'bg-primary text-primary-fg'}`}>{g.stories.length}</span>
              <span className="absolute inset-x-2 bottom-2 truncate text-xs font-bold text-white">{g.author.id === user?.id ? 'Ma story' : `${g.author.first_name} ${g.author.last_name}`}</span>
            </button>
          )
        })}
      </div>
      <div className="hidden gap-5 overflow-x-auto pb-1 lg:flex" aria-label="Stories">
        <label className="flex w-[84px] shrink-0 cursor-pointer flex-col items-center gap-2 text-center text-xs font-semibold">
          <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-md shadow-primary/30">
            {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Icon name="add" bold size={34} />}</span>
          Créer une story
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        {groups.map((g) => (
          <button key={g.author.id} onClick={() => setOpen(g)} className="flex w-[84px] shrink-0 flex-col items-center gap-2 text-center text-xs font-semibold" aria-label={`Story de ${g.author.first_name}`}>
            <span className={`rounded-full p-[3px] ${g.all_seen ? 'bg-line' : 'bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-amber-400'}`}>
              <span className="block rounded-full bg-card p-[3px]"><Avatar user={g.author} size={64} /></span>
            </span>
            <span className="w-full truncate">{g.author.id === user?.id ? 'Ma story' : g.author.first_name}</span>
          </button>
        ))}
      </div>
      <label className="mt-1 flex items-center gap-2 text-xs text-muted">Visibilité de ta prochaine story :
        <select value={vis} onChange={(e) => setVis(e.target.value)} className="rounded-lg border border-line bg-soft px-2 py-1">
          <option value="everyone">Tout le campus</option><option value="friends">Amis uniquement</option>
        </select>
      </label>
      <ErrorBox>{err}</ErrorBox>
      {open && <Viewer group={open} onClose={() => { setOpen(null); load() }} onSeen={load} />}
    </div>
  )
}
