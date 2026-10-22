import { useEffect, useState } from 'react'
import { api } from './api'

/** Badge counters (friend requests, unread messages, unread notifications), refreshed every 20 s. */
export function useCounts() {
  const [c, setC] = useState({ friends: 0, messages: 0, notifications: 0 })
  useEffect(() => {
    let alive = true
    const load = async () => {
      const [f, m, n] = await Promise.allSettled([
        api<unknown[]>('/friends/requests/'), api<{ unread: number }>('/conversations/unread/'), api<{ unread: number }>('/notifications/unread-count/'),
      ])
      if (!alive) return
      setC({
        friends: f.status === 'fulfilled' ? f.value.length : 0,
        messages: m.status === 'fulfilled' ? m.value.unread : 0,
        notifications: n.status === 'fulfilled' ? n.value.unread : 0,
      })
    }
    load()
    const t = setInterval(load, 20000)
    return () => { alive = false; clearInterval(t) }
  }, [])
  return c
}
