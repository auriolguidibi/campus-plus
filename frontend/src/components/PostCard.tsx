import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, type Comment, type Post } from '../api'
import { useAuth } from '../auth'
import ReportButton from './ReportButton'
import { Avatar, ErrorBox, Spinner, timeAgo } from './ui'

function Comments({ post, onCount }: { post: Post; onCount: (n: number) => void }) {
  const { user: me } = useAuth()
  const [items, setItems] = useState<Comment[] | null>(null)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api<Comment[]>(`/posts/${post.id}/comments/`).then(setItems).catch(() => setErr('Chargement impossible.'))
  }, [post.id])

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    try {
      const c = await api<Comment>(`/posts/${post.id}/comments/`, { body: { text, parent: replyTo?.id ?? null } })
      setItems((l) => [...(l ?? []), c]); setText(''); setReplyTo(null); onCount((items?.length ?? 0) + 1)
    } catch { setErr("Le commentaire n'a pas pu être envoyé.") }
  }

  const row = (c: Comment, nested = false) => (
    <div key={c.id} className={nested ? 'ml-8 mt-2' : 'mt-3'}>
      <div className="flex gap-2">
        <Avatar user={c.author} size={28} />
        <div className="rounded-2xl bg-soft px-3 py-2 text-sm">
          <Link to={`/u/${c.author.username}`} className="font-bold">{c.author.first_name || c.author.username}</Link>{' '}
          <span className="text-xs text-muted">{timeAgo(c.created_at)}</span>
          <p className="whitespace-pre-wrap break-words">{c.text}</p>
          {!nested && <button className="text-xs font-semibold text-link" onClick={() => setReplyTo(c)}>Répondre</button>}
          {c.author.id !== me?.id && <span className="ml-3"><ReportButton type="comment" id={c.id} /></span>}
        </div>
      </div>
      {(items ?? []).filter((r) => r.parent === c.id).map((r) => row(r, true))}
    </div>
  )

  return (
    <div className="mt-3 border-t border-line pt-2">
      {items === null && !err ? <Spinner /> : (items ?? []).filter((c) => !c.parent).map((c) => row(c))}
      <ErrorBox>{err}</ErrorBox>
      <form onSubmit={send} className="mt-3 flex gap-2">
        <input className="field !py-2" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)}
          placeholder={replyTo ? `Répondre à ${replyTo.author.username}…` : 'Écrire un commentaire…'} />
        <button className="rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg">Envoyer</button>
      </form>
    </div>
  )
}

function MediaGrid({ urls }: { urls: string[] }) {
  if (!urls.length) return null
  return (
    <div className={`mt-3 grid gap-1 overflow-hidden rounded-xl ${urls.length > 1 ? 'grid-cols-2' : ''}`}>
      {urls.map((u, i) => (
        <a key={u} href={u} target="_blank" rel="noreferrer" className={urls.length === 3 && i === 0 ? 'col-span-2' : ''}>
          <img src={u} alt="" loading="lazy" className="h-full max-h-80 w-full bg-soft object-cover" />
        </a>
      ))}
    </div>
  )
}

export default function PostCard({ post, onChange, onRemove }: { post: Post; onChange: (p: Post) => void; onRemove: () => void }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const mine = user?.id === post.author.id

  async function toggle(kind: 'react' | 'favorite') {
    const { active } = await api<{ active: boolean }>(`/posts/${post.id}/${kind}/`, { method: 'POST' })
    onChange(kind === 'react'
      ? { ...post, reacted: active, reaction_count: post.reaction_count + (active ? 1 : -1) }
      : { ...post, favorited: active })
  }
  async function remove() {
    if (!confirm('Supprimer cette publication ?')) return
    await api(`/posts/${post.id}/`, { method: 'DELETE' }); onRemove()
  }

  return (
    <article className="card p-4">
      <header className="flex items-center gap-3">
        <Link to={`/u/${post.author.username}`}><Avatar user={post.author} /></Link>
        <div className="min-w-0 flex-1">
          <Link to={`/u/${post.author.username}`} className="block truncate font-semibold">{post.author.first_name} {post.author.last_name}</Link>
          <p className="truncate text-xs text-muted">
            {timeAgo(post.created_at)} · {post.author.field_of_study}
            {post.community && <> · <Link to={`/communautes/${post.community}`} className="text-link">{post.community_name}</Link></>}
          </p>
        </div>
        {mine && <button onClick={remove} className="text-xs text-danger">Supprimer</button>}
      </header>
      {post.text && <p className="mt-3 whitespace-pre-wrap break-words text-sm">{post.text}</p>}
      <MediaGrid urls={post.media} />
      <footer className="mt-3 flex items-center gap-5 text-sm text-muted">
        <button onClick={() => toggle('react')} className={post.reacted ? 'font-semibold text-link' : ''}>♥ {post.reaction_count}</button>
        <button onClick={() => setOpen(!open)}>💬 {post.comment_count}</button>
        {!mine && <ReportButton type="post" id={post.id} />}
        <button onClick={() => toggle('favorite')} className={`ml-auto ${post.favorited ? 'font-semibold text-accent' : ''}`}>
          {post.favorited ? '★ Enregistré' : '☆ Enregistrer'}
        </button>
      </footer>
      {open && <Comments post={post} onCount={(n) => onChange({ ...post, comment_count: n })} />}
    </article>
  )
}
