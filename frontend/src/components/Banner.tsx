import type { ReactNode } from 'react'
import type { IconName } from '../icons'
import { useBackgrounds } from '../dataMode'
import Icon from './Icon'

/** Section header with a campus photo background (public/img/*.jpg). */
export default function Banner({ title, subtitle, icon, action, image = 'hero' }: { title: string; subtitle?: string; icon: IconName; action?: ReactNode; image?: 'hero' | 'classroom' | 'lake' | 'park' }) {
  const photos = useBackgrounds()
  const grad = 'linear-gradient(100deg, rgb(24 10 70 / .88) 0%, rgb(24 10 70 / .30) 100%)'
  return (
    <header className="relative overflow-hidden rounded-xl2 bg-cover bg-center p-4 text-white shadow-md"
      style={{ backgroundImage: photos ? `${grad}, url('/img/${image}.jpg')` : 'linear-gradient(100deg, rgb(24 10 70), rgb(76 29 149))' }}>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15"><Icon name={icon} bold size={24} /></span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-white/80">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  )
}
