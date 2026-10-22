import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type PublicUser } from '../api'
import { Avatar, Spinner, timeAgo } from '../components/ui'

interface Board { criteria: string; entries: { rank: number; user?: PublicUser; label?: string; points: number }[]; me: { rank: number; points: number } | null }
interface Badges { points: number; badges: { code: string; name: string; description: string; icon: string; earned_at: string | null }[] }
interface Entry { id: number; points: number; reason: string; created_at: string }

export default function Leaderboard() {
  const [period, setPeriod] = useState<'week' | 'all' | 'promotion'>('week')
  const [board, setBoard] = useState<Board | null>(null)
  const [badges, setBadges] = useState<Badges | null>(null)
  const [history, setHistory] = useState<Entry[]>([])

  useEffect(() => { setBoard(null); api<Board>(`/leaderboard/?period=${period}`).then(setBoard) }, [period])
  useEffect(() => { api<Badges>('/badges/').then(setBadges); api<Entry[]>('/points/history/').then(setHistory) }, [])

  return (
    <div className="space-y-5 pt-6">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Classement</h1><Link to="/defis" className="text-sm font-semibold text-link">Défis</Link></div>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-soft p-1" role="tablist">
        {([['week', 'Semaine'], ['all', 'Général'], ['promotion', 'Promotions']] as const).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={period === v} onClick={() => setPeriod(v)} className={`rounded-lg py-2 text-xs font-semibold ${period === v ? 'bg-primary text-primary-fg' : 'text-muted'}`}>{l}</button>
        ))}
      </div>
      {board === null ? <Spinner /> : (
        <section className="space-y-2">
          {board.me && <p className="card bg-primary/10 p-3 text-sm">Ta place : <b>#{board.me.rank}</b> avec <b>{board.me.points} pts</b></p>}
          {board.entries.length === 0 ? <p className="py-6 text-center text-sm text-muted">Pas encore de points sur cette période. Participe à un défi !</p> : (
            <div className="card divide-y divide-line px-3">
              {board.entries.map((e) => (
                <div key={e.rank} className="flex items-center gap-3 py-2.5">
                  <span className="w-6 text-center font-bold text-muted">{e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : e.rank}</span>
                  {e.user && <Avatar user={e.user} size={34} />}
                  <span className="flex-1 truncate text-sm font-semibold">{e.user ? `${e.user.first_name} ${e.user.last_name}` : e.label}</span>
                  <span className="text-sm font-bold text-link">{e.points} pts</span>
                </div>
              ))}
            </div>
          )}
          <details className="text-xs text-muted"><summary className="cursor-pointer">Comment sont calculés les points ?</summary><p className="mt-1">{board.criteria}</p></details>
        </section>
      )}

      {badges && (
        <section className="space-y-2">
          <h2 className="font-semibold">Mes badges · {badges.points} pts au total</h2>
          <div className="grid grid-cols-2 gap-2">
            {badges.badges.map((b) => (
              <div key={b.code} className={`card p-3 text-center ${b.earned_at ? '' : 'opacity-50'}`}>
                <div className="text-3xl" aria-hidden>{b.icon}</div>
                <p className="text-sm font-semibold">{b.name}</p>
                <p className="text-[11px] text-muted">{b.earned_at ? `Obtenu le ${new Date(b.earned_at).toLocaleDateString('fr-FR')}` : b.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      {history.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Historique des récompenses</h2>
          <div className="card divide-y divide-line px-3">
            {history.map((h) => <div key={h.id} className="flex justify-between py-2 text-sm"><span>{h.reason} <span className="text-xs text-muted">· {timeAgo(h.created_at)}</span></span><b className="text-accent">+{h.points}</b></div>)}
          </div>
        </section>
      )}
    </div>
  )
}
