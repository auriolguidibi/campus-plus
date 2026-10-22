import type { ReactNode } from 'react'
import type { PublicUser } from '../api'

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2 text-primary">
      <svg width={size} height={size} viewBox="0 0 48 48" fill="currentColor" aria-hidden>
        <path d="M24 6 2 17l22 11 17-8.5V32h3V17z" />
        <path d="M11 25v8c0 3 6 7 13 7s13-4 13-7v-8l-13 6.500z" opacity=".75" />
      </svg>
      <span className="font-extrabold tracking-tight text-fg" style={{ fontSize: size * 0.8 }}>
        Campus<span className="text-primary">+</span>
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
