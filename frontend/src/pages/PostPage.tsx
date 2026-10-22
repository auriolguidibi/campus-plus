import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type Post } from '../api'
import Icon from '../components/Icon'
import PostCard from '../components/PostCard'
import { Spinner } from '../components/ui'

export default function PostPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const [post, setPost] = useState<Post | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => { api<Post>(`/posts/${id}/`).then(setPost).catch(() => setMissing(true)) }, [id])
  return (
    <div className="space-y-3 pt-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-link"><Icon name="back" size={18} /> Accueil</Link>
      {missing ? <p className="py-10 text-center text-muted">Cette publication n'est pas disponible.</p> : post ? <PostCard post={post} onChange={setPost} onRemove={() => nav('/')} /> : <Spinner />}
    </div>
  )
}
