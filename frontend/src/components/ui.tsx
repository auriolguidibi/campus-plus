import type { ReactNode } from 'react'
import type { PublicUser } from '../api'
import Icon from './Icon'

export function Logo({ size = 40, tone = 'auto' }: { size?: number; tone?: 'auto' | 'light' }) {
  return (
    <div className={`flex items-center gap-2 ${tone === 'light' ? 'text-white' : 'text-link'}`}>
      <Icon name="school" bold size={size} />
      <span className={`font-extrabold tracking-tight ${tone === 'light' ? 'text-white' : 'text-fg'}`} style={{ fontSize: size * 0.8 }}>
        Campus<span className={tone === 'light' ? 'text-emerald-300' : 'text-link'}>+</span>
      </span>
    </div>
  )
}

export function Avatar({ user, size = 40 }: { user: Pick<PublicUser, 'first_name' | 'username'>; size?: number }) {
  const letter = (user.first_name || user.username).charAt(0).toUpperCase()
  return (
    <div className="grid shrink-0 place-items-center rounded-full bg-primary font-bold text-primary-fg"
      style={{ width: size, height: size, fontSize: size * 0.42 }}>{letter}</div>
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
