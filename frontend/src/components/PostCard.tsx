import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, type Comment, type Post } from '../api'
import { useAuth } from '../auth'
import { Img } from '../dataMode'
import Icon from './Icon'
import ReportButton from './ReportButton'
import { Avatar, ErrorBox, Spinner, timeAgo } from './ui'

const HIDDEN_KEY = 'campus-hidden-posts'
const hiddenIds = (): number[] => { try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') } catch { return [] } }
const saveHidden = (ids: number[]) => { try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(ids.slice(-300))) } catch { /* storage blocked */ } }

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
    <div key={c.id} className={nested ? 'ml-10 mt-2' : 'mt-3'}>
      <div className="flex gap-2">
        <Avatar user={c.author} size={32} />
        <div>
          <div className="rounded-2xl bg-soft px-3 py-2 text-sm">
            <Link to={`/u/${c.author.username}`} className="font-bold">{c.author.first_name || c.author.username}</Link>
            <p className="whitespace-pre-wrap break-words">{c.text}</p>
          </div>
          <p className="ml-3 mt-0.5 flex gap-3 text-xs font-semibold text-muted">
            <span className="font-normal">{timeAgo(c.created_at)}</span>
            {!nested && <button onClick={() => setReplyTo(c)}>Répondre</button>}
            {c.author.id !== me?.id && <ReportButton type="comment" id={c.id} />}
          </p>
        </div>
      </div>
      {(items ?? []).filter((r) => r.parent === c.id).map((r) => row(r, true))}
    </div>
  )

  return (
    <div className="border-t border-line px-4 pb-3 pt-1">
      {items === null && !err ? <Spinner /> : (items ?? []).filter((c) => !c.parent).map((c) => row(c))}
      <ErrorBox>{err}</ErrorBox>
      <form onSubmit={send} className="mt-3 flex items-center gap-2">
        {me && <Avatar user={me} size={32} />}
        <div className="flex min-w-0 flex-1 items-center rounded-full bg-soft px-4">
          <input className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted/70" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)}
            placeholder={replyTo ? `Répondre à ${replyTo.author.username}…` : 'Écrire un commentaire…'} aria-label="Commentaire" />
        </div>
        <button aria-label="Envoyer" disabled={!text.trim()} className="text-link disabled:opacity-40"><Icon name="send" bold size={24} /></button>
      </form>
    </div>
  )
}

/** Facebook-style collage: 1 = full width, 2 = side by side, 3 = big left + two stacked, 4 = 2x2. */
function Collage({ urls }: { urls: string[] }) {
  if (!urls.length) return null
  const cell = 'h-full w-full object-cover'
  if (urls.length === 1) return <a href={urls[0]} target="_blank" rel="noreferrer" className="mt-3 block"><Img src={urls[0]} className="max-h-[32rem] w-full object-cover" /></a>
  if (urls.length === 3) {
    return (
      <div className="mt-3 grid aspect-[4/3] grid-cols-[2fr_1fr] grid-rows-2 gap-0.5">
        <a href={urls[0]} target="_blank" rel="noreferrer" className="row-span-2"><Img src={urls[0]} className={cell} /></a>
        <a href={urls[1]} target="_blank" rel="noreferrer"><Img src={urls[1]} className={cell} /></a>
        <a href={urls[2]} target="_blank" rel="noreferrer"><Img src={urls[2]} className={cell} /></a>
      </div>
    )
  }
  return (
    <div className="mt-3 grid grid-cols-2 gap-0.5">
      {urls.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer" className="aspect-square"><Img src={u} className={cell} /></a>)}
    </div>
  )
}

export default function PostCard({ post, onChange, onRemove }: { post: Post; onChange: (p: Post) => void; onRemove: () => void }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const [hidden, setHidden] = useState(() => hiddenIds().includes(post.id))
  const [note, setNote] = useState('')
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
  async function share() {
    const url = `${location.origin}/publication/${post.id}`
    try {
      if (navigator.share) await navigator.share({ title: `${post.author.first_name} sur EIG Vibes`, url })
      else { await navigator.clipboard.writeText(url); setNote('Lien copié') ; setTimeout(() => setNote(''), 2000) }
    } catch { /* share cancelled */ }
  }
  const hide = (v: boolean) => { setHidden(v); saveHidden(v ? [...hiddenIds(), post.id] : hiddenIds().filter((i) => i !== post.id)) }

  if (hidden) {
    return (
      <div className="-mx-4 flex items-center justify-between bg-card px-4 py-4 text-sm lg:mx-0 lg:rounded-2xl lg:border lg:border-line">
        <span className="text-muted">Publication masquée.</span>
        <button className="font-semibold text-link" onClick={() => hide(false)}>Annuler</button>
      </div>
    )
  }

  const act = 'flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-semibold text-muted'
  return (
    <article className="-mx-4 bg-card lg:mx-0 lg:rounded-2xl lg:border lg:border-line">
      <header className="flex items-start gap-3 px-4 pt-3">
        <Link to={`/u/${post.author.username}`}><Avatar user={post.author} size={44} ring /></Link>
        <div className="min-w-0 flex-1">
          <Link to={`/u/${post.author.username}`} className="block truncate text-[15px] font-bold leading-tight">{post.author.first_name} {post.author.last_name}</Link>
          <p className="flex items-center gap-1 truncate text-xs text-muted">
            {timeAgo(post.created_at)} · <Icon name={post.community ? 'users' : 'global'} size={13} />
            {post.community && <Link to={`/communautes/${post.community}`} className="truncate font-semibold text-link">{post.community_name}</Link>}
          </p>
        </div>
        <div className="relative flex items-center gap-1">
          <button onClick={() => setMenu(!menu)} aria-label="Plus d'options" aria-expanded={menu} className="grid h-9 w-9 place-items-center rounded-full text-muted"><Icon name="more" bold size={22} /></button>
          <button onClick={() => hide(true)} aria-label="Masquer la publication" className="grid h-9 w-9 place-items-center rounded-full text-muted"><Icon name="close" size={22} /></button>
          {menu && (
            <div className="absolute right-0 top-10 z-10 w-56 space-y-1 rounded-xl border border-line bg-card p-2 text-sm shadow-xl">
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-soft" onClick={() => { toggle('favorite'); setMenu(false) }}>
                <Icon name="bookmark" bold={post.favorited} size={20} /> {post.favorited ? 'Retirer des enregistrements' : 'Enregistrer'}
              </button>
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-soft" onClick={() => { share(); setMenu(false) }}><Icon name="share" size={20} /> Copier le lien</button>
              {mine
                ? <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-danger hover:bg-soft" onClick={() => { setMenu(false); remove() }}><Icon name="trash" size={20} /> Supprimer</button>
                : <div className="px-3 py-2"><ReportButton type="post" id={post.id} label="Signaler la publication" /></div>}
            </div>
          )}
        </div>
      </header>

      {post.text && <p className="whitespace-pre-wrap break-words px-4 pt-3 text-[15px] leading-snug">{post.text}</p>}
      <Collage urls={post.media} />

      {(post.reaction_count > 0 || post.comment_count > 0) && (
        <div className="flex items-center justify-between px-4 pt-3 text-sm text-muted">
          <span className="flex items-center gap-1.5">{post.reaction_count > 0 && <><span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-fg"><Icon name="like" bold size={12} /></span>{post.reaction_count}</>}</span>
          {post.comment_count > 0 && <button onClick={() => setOpen(!open)}>{post.comment_count} commentaire{post.comment_count > 1 ? 's' : ''}</button>}
        </div>
      )}
      <footer className="mx-4 mt-2 flex items-center border-t border-line">
        <button onClick={() => toggle('react')} className={`${act} ${post.reacted ? 'text-link' : ''}`} aria-pressed={post.reacted}><Icon name="like" bold={post.reacted} size={22} /> J'aime</button>
        <button onClick={() => setOpen(!open)} className={act}><Icon name="chatLine" size={22} /> Commenter</button>
        <button onClick={share} className={act}><Icon name="share" size={22} /> {note || 'Partager'}</button>
      </footer>
      {open && <Comments post={post} onCount={(n) => onChange({ ...post, comment_count: n })} />}
    </article>
  )
}
