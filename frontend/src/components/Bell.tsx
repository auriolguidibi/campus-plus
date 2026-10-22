import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'

export default function Bell() {
  const [n, setN] = useState(0)
  useEffect(() => {
    const load = () => api<{ unread: number }>('/notifications/unread-count/').then((r) => setN(r.unread)).catch(() => {})
    load()
    const t = setInterval(load, 20000)
    return () => clearInterval(t)
  }, [])
  return (
    <Link to="/notifications" aria-label={n ? `Notifications, ${n} non lues` : 'Notifications'} className="relative px-2 text-xl">
      🔔{n > 0 && <span className="absolute -right-0.5 -top-1 rounded-full bg-danger px-1.5 text-[10px] font-bold text-primary-fg">{n > 99 ? '99+' : n}</span>}
    </Link>
  )
}
