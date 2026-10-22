import { useCallback, useEffect, useState } from 'react'
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

  const mineGroup = groups.find((g) => g.author.id === user?.id)
  return (
    <div className="mb-4">
      <div className="flex gap-3 overflow-x-auto pb-1" aria-label="Stories">
        <label className="flex w-16 shrink-0 cursor-pointer flex-col items-center gap-1 text-[11px]">
          <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-primary text-2xl text-link">{busy ? '…' : '+'}</span>
          Ajouter
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        {groups.map((g) => (
          <button key={g.author.id} onClick={() => setOpen(g)} className="flex w-16 shrink-0 flex-col items-center gap-1 text-[11px]">
            <span className={`rounded-full p-0.5 ${g.all_seen ? 'bg-line' : 'bg-gradient-to-tr from-primary to-accent'}`}>
              <span className="block rounded-full bg-bg p-0.5"><Avatar user={g.author} size={48} /></span>
            </span>
            <span className="w-full truncate">{g.author.id === user?.id ? 'Ma story' : g.author.first_name}</span>
          </button>
        ))}
      </div>
      {!mineGroup && (
        <label className="mt-1 flex items-center gap-2 text-xs text-muted">Visibilité de ta prochaine story :
          <select value={vis} onChange={(e) => setVis(e.target.value)} className="rounded-lg border border-line bg-soft px-2 py-1">
            <option value="everyone">Tout le campus</option><option value="friends">Amis uniquement</option>
          </select>
        </label>
      )}
      <ErrorBox>{err}</ErrorBox>
      {open && <Viewer group={open} onClose={() => { setOpen(null); load() }} onSeen={load} />}
    </div>
  )
}
