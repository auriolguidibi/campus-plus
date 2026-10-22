import { useCallback, useEffect, useState } from 'react'
import { api, type Page, type Post } from '../api'
import PostCard from './PostCard'
import { ErrorBox, Spinner } from './ui'

/** Paginated post list for a given query string (e.g. "scope=campus"). Reloads when the query changes. */
export default function PostList({ query, empty }: { query: string; empty: string }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async (path: string, reset: boolean) => {
    setLoading(true); setErr('')
    try {
      const page = await api<Page<Post>>(path)
      // De-duplicate in case new posts shifted the pages.
      setPosts((old) => { const base = reset ? [] : old; return [...base, ...page.results.filter((p) => !base.some((o) => o.id === p.id))] })
      setNext(page.next ? page.next.replace(/^.*\/api/, '') : null)
    } catch { setErr('Impossible de charger les publications.') } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(`/posts/?${query}`, true) }, [load, query])

  return (
    <>
      <div className="space-y-1.5 lg:space-y-4">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} onChange={(n) => setPosts((l) => l.map((x) => (x.id === n.id ? n : x)))}
            onRemove={() => setPosts((l) => l.filter((x) => x.id !== p.id))} />
        ))}
      </div>
      {loading && <div className="py-6"><Spinner /></div>}
      <ErrorBox>{err}</ErrorBox>
      {!loading && !err && posts.length === 0 && <p className="py-10 text-center text-sm text-muted">{empty}</p>}
      {next && !loading && <button className="btn-outline mt-4" onClick={() => load(next, false)}>Voir plus</button>}
    </>
  )
}
