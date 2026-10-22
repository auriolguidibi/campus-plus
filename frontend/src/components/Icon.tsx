import type { SVGProps } from 'react'
import { ICONS, type IconName } from '../icons'

/** Iconify (Solar) icon. `bold` is used for active/selected states. Decorative by default (aria-hidden). */
export default function Icon({ name, bold = false, size = 20, label, ...rest }: { name: IconName; bold?: boolean; size?: number; label?: string } & SVGProps<SVGSVGElement>) {
  const C = ICONS[name][bold ? 'bold' : 'linear']
  return <C width={size} height={size} aria-hidden={label ? undefined : true} aria-label={label} role={label ? 'img' : undefined} {...rest} />
}
