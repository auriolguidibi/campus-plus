import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import type { IconName } from '../icons'
import Icon from './Icon'

interface Common { label: string; icon?: IconName; error?: string; hint?: string }

/** Labelled input with a leading Iconify icon, error state and (for type=password) a show/hide toggle. */
export function Field({ label, icon, error, hint, type = 'text', className = '', ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  const [show, setShow] = useState(false)
  const isPw = type === 'password'
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-muted">{label}{rest.required && <span className="text-danger"> *</span>}</label>
      <div className={`flex items-center gap-2 rounded-2xl border bg-soft px-3.5 transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15 ${error ? 'border-danger' : 'border-line'}`}>
        {icon && <Icon name={icon} size={20} className="shrink-0 text-muted" />}
        <input id={id} type={isPw && show ? 'text' : type} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : undefined}
          className="min-w-0 flex-1 bg-transparent py-3.5 text-sm text-fg outline-none placeholder:text-muted/70" {...rest} />
        {isPw && (
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} className="text-muted">
            <Icon name={show ? 'eyeOff' : 'eye'} size={20} />
          </button>
        )}
      </div>
      {error ? <p id={`${id}-e`} role="alert" className="mt-1 text-xs text-danger">{error}</p> : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

export function SelectField({ label, icon, error, hint, children, className = '', ...rest }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-muted">{label}{rest.required && <span className="text-danger"> *</span>}</label>
      <div className={`flex items-center gap-2 rounded-2xl border bg-soft px-3.5 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15 ${error ? 'border-danger' : 'border-line'}`}>
        {icon && <Icon name={icon} size={20} className="shrink-0 text-muted" />}
        <select id={id} className="min-w-0 flex-1 bg-transparent py-3.5 text-sm text-fg outline-none" {...rest}>{children}</select>
      </div>
      {error ? <p role="alert" className="mt-1 text-xs text-danger">{error}</p> : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

export function TextArea({ label, icon, error, hint, className = '', ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-muted">{label}{rest.required && <span className="text-danger"> *</span>}</label>
      <div className={`flex gap-2 rounded-2xl border bg-soft px-3.5 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15 ${error ? 'border-danger' : 'border-line'}`}>
        {icon && <Icon name={icon} size={20} className="mt-3.5 shrink-0 text-muted" />}
        <textarea id={id} className="min-h-24 min-w-0 flex-1 resize-y bg-transparent py-3.5 text-sm text-fg outline-none placeholder:text-muted/70" {...rest} />
      </div>
      <div className="mt-1 flex justify-between text-xs">
        <span className={error ? 'text-danger' : 'text-muted'} role={error ? 'alert' : undefined}>{error || hint}</span>
        {rest.maxLength && rest.value !== undefined && <span className="text-muted">{String(rest.value ?? '').length}/{rest.maxLength}</span>}
      </div>
    </div>
  )
}

export function Check({ children, ...rest }: InputHTMLAttributes<HTMLInputElement> & { children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input type="checkbox" className="h-5 w-5 rounded-md border-line accent-primary" {...rest} />
      <span>{children}</span>
    </label>
  )
}

/** Primary action button with a loading state. */
export function Submit({ busy, children, icon, ...rest }: { busy?: boolean; icon?: IconName } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className="btn flex items-center justify-center gap-2" disabled={busy || rest.disabled} {...rest}>
      {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-fg/40 border-t-primary-fg" aria-hidden /> : icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  )
}

export function passwordStrength(pw: string) {
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^\w\s]/.test(pw)) s++
  return Math.min(4, Math.max(pw ? 1 : 0, s - (pw.length < 8 ? 1 : 0)))
}

export function StrengthMeter({ value }: { value: string }) {
  const n = passwordStrength(value)
  const labels = ['', 'Faible', 'Moyen', 'Bon', 'Excellent']
  const colors = ['bg-line', 'bg-danger', 'bg-danger', 'bg-accent', 'bg-accent']
  return (
    <div aria-live="polite">
      <div className="flex gap-1">{[1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= n ? colors[n] : 'bg-line'}`} />)}</div>
      {value && <p className="mt-1 text-xs text-muted">Sécurité : {labels[n]}</p>}
    </div>
  )
}
