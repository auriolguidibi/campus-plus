import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, ApiError, type Community, type Page } from '../api'
import { ErrorBox } from '../components/ui'

const MAX = 4

export default function Create() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [community, setCommunity] = useState(params.get('communaute') ?? '')
  const [groups, setGroups] = useState<Community[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])

  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews])
  useEffect(() => { api<Page<Community>>('/communities/?scope=mine').then((p) => setGroups(p.results)).catch(() => {}) }, [])

  function pick(list: FileList | null) {
    const next = [...files, ...Array.from(list ?? [])]
    if (next.length > MAX) setErr(`${MAX} photos maximum.`); else setErr('')
    setFiles(next.slice(0, MAX))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    const fd = new FormData()
    fd.append('text', text)
    if (community) fd.append('community', community)
    files.forEach((f) => fd.append('images', f))
    try { await api('/posts/', { body: fd }); nav(community ? `/communautes/${community}` : '/') }
    catch (x) { setErr(x instanceof ApiError ? x.text : 'Serveur injoignable.') }
    finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-3 pt-6">
      <h1 className="text-2xl font-bold">Nouvelle publication</h1>
      <select className="field" value={community} onChange={(e) => setCommunity(e.target.value)} aria-label="Destination">
        <option value="">Sur mon profil (amis)</option>
        {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
      <textarea className="field min-h-32" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Quoi de neuf sur le campus ?" />
      {previews.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {previews.map((u, i) => (
            <div key={u} className="relative">
              <img src={u} alt="" className="aspect-square w-full rounded-lg object-cover" />
              <button type="button" aria-label="Retirer la photo" onClick={() => setFiles(files.filter((_, j) => j !== i))}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-fg/70 text-xs text-bg">✕</button>
            </div>
          ))}
        </div>
      )}
      <label className="btn-outline block cursor-pointer text-center">
        📷 Ajouter des photos ({files.length}/{MAX})
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
      </label>
      <p className="text-right text-xs text-muted">{text.length}/2000 · Vidéos et sondages : plus tard.</p>
      <ErrorBox>{err}</ErrorBox>
      <button className="btn" disabled={busy || (!text.trim() && !files.length)}>{busy ? 'Envoi en cours…' : 'Publier'}</button>
    </form>
  )
}
