import type { ReactNode } from 'react'
import type { PublicUser } from '../api'
import { useDataMode } from '../dataMode'
import Icon from './Icon'

export function Logo({ size = 40, tone = 'auto' }: { size?: number; tone?: 'auto' | 'light' }) {
  const light = tone === 'light'
  return (
    <div className="flex items-center gap-2" aria-label="EIG Vibes" role="img">
      <img src="/img/mascot.png" alt="" width={size} height={size} draggable={false} className="rounded-xl object-cover shadow-md shadow-primary/30" style={{ width: size, height: size }} />
      <span className="font-black italic leading-none tracking-tight" style={{ fontSize: size * 0.62 }}>
        <span className={light ? 'text-white' : 'text-fg'}>EIG </span>
        <span className={`bg-gradient-to-r bg-clip-text text-transparent ${light ? 'from-violet-300 to-fuchsia-300' : 'from-violet-600 to-fuchsia-500'}`}>Vibes</span>
      </span>
    </div>
  )
}

export function Avatar({ user, size = 40, ring = false }: { user: Pick<PublicUser, 'first_name' | 'username'> & { avatar?: string | null }; size?: number; ring?: boolean }) {
  const { free } = useDataMode()
  const letter = (user.first_name || user.username).charAt(0).toUpperCase()
  const base = `shrink-0 rounded-full ${ring ? 'ring-2 ring-link ring-offset-2 ring-offset-card' : ''}`
  if (user.avatar && !free) return <img src={user.avatar} alt="" loading="lazy" className={`${base} object-cover`} style={{ width: size, height: size }} />
  return (
    <div className={`grid place-items-center bg-primary font-bold text-primary-fg ${base}`} style={{ width: size, height: size, fontSize: size * 0.42 }}>{letter}</div>
  )
}

export const Spinner = () => (
  <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-line border-t-primary" role="status" aria-label="Chargement" />
)

export function ErrorBox({ children }: { children?: ReactNode }) {
  return children ? <p role="alert" className="whitespace-pre-line rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{children}</p> : null
}

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return "À l'instant"
  if (s < 3600) return `${Math.floor(s / 60)} min`
  if (s < 86400) return `${Math.floor(s / 3600)} h`
  return new Date(iso).toLocaleDateString('fr-FR')
}
