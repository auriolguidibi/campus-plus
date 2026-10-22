import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import Icon from '../components/Icon'
import { Check, Field, SelectField, StrengthMeter, Submit, passwordStrength } from '../components/form'
import { ErrorBox, Logo } from '../components/ui'

const HERO = "linear-gradient(180deg, rgb(24 10 70 / .30) 0%, rgb(24 10 70 / .50) 40%, rgb(24 10 70 / .93) 100%), url('/img/welcome.jpg')"

function Credit() {
  return (
    <p className="text-[10px] text-white/60">
      Photo : <a className="underline" href="https://commons.wikimedia.org/wiki/File:Campus_hustle.jpg" target="_blank" rel="noreferrer">Marksllan</a>, CC BY-SA 4.0
    </p>
  )
}

export function Welcome() {
  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-between bg-cover bg-center px-6 pb-8 pt-safe text-white"
      style={{ backgroundImage: HERO, backgroundPosition: 'center 25%' }}>
      <div className="mt-20 flex flex-col items-center gap-3 text-center">
        <Logo size={56} tone="light" />
        <p className="text-base font-medium text-white/90">Ton école. Tes amis. Tes délires.</p>
      </div>
      <div className="space-y-3">
        <ul className="mb-6 space-y-2 text-sm text-white/85">
          {([['users', 'Retrouve ta promo, tes clubs et tes groupes'], ['shop', 'Achète et vends entre étudiants'], ['trophy', 'Relève des défis et grimpe au classement']] as const).map(([i, t]) => (
            <li key={t} className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-white/15"><Icon name={i} size={18} /></span>{t}</li>
          ))}
        </ul>
        <Link to="/connexion" className="flex w-full items-center justify-center rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-fg shadow-lg">Se connecter</Link>
        <Link to="/inscription" className="flex w-full items-center justify-center rounded-2xl border-2 border-white/80 py-3.5 text-sm font-semibold">Créer un compte</Link>
        <p className="pt-2 text-center text-xs text-white/75">Rejoins la communauté des étudiants de ton école !</p>
        <div className="text-center"><Credit /></div>
      </div>
    </div>
  )
}

function Shell({ tab, children }: { tab?: 'login' | 'register'; children: ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <header className="relative flex h-60 flex-col items-center justify-center gap-2 bg-cover bg-center pt-safe text-white" style={{ backgroundImage: HERO, backgroundPosition: 'center 30%' }}>
        <Logo size={44} tone="light" />
        <p className="text-sm text-white/90">Ton école. Tes amis. Tes délires.</p>
      </header>
      <main className="relative -mt-8 min-h-[calc(100dvh-13rem)] rounded-t-[2rem] bg-bg px-6 pb-10 pt-6 shadow-[0_-12px_30px_-12px_rgb(0_0_0/.35)]">
        {tab && (
          <nav className="mb-6 grid grid-cols-2 border-b border-line" aria-label="Authentification">
            {([['/connexion', 'Connexion'], ['/inscription', 'Inscription']] as const).map(([to, l]) => (
              <NavLink key={to} to={to} className={({ isActive }) => `pb-3 text-center text-sm font-semibold ${isActive ? '-mb-px border-b-2 border-primary text-link' : 'text-muted'}`}>{l}</NavLink>
            ))}
          </nav>
        )}
        {children}
      </main>
    </div>
  )
}

export function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [remember, setRemember] = useState(true)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    try { await login(id, pw, remember); nav('/') }
    catch (x) { setErr(x instanceof ApiError ? (x.status === 429 ? 'Trop de tentatives, réessaie dans une minute.' : x.text) : 'Serveur injoignable.') }
    finally { setBusy(false) }
  }

  return (
    <Shell tab="login">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="E-mail ou pseudo" icon="mail" value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" placeholder="toi@ecole.bj" required />
        <Field label="Mot de passe" icon="lock" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" placeholder="••••••••" required />
        <div className="flex items-center justify-between">
          <Check checked={remember} onChange={(e) => setRemember(e.target.checked)}>Se souvenir de moi</Check>
          <Link to="/mot-de-passe-oublie" className="text-sm font-semibold text-link">Mot de passe oublié ?</Link>
        </div>
        <ErrorBox>{err}</ErrorBox>
        <Submit busy={busy} disabled={!id || !pw} icon="login">Se connecter</Submit>
      </form>
      <p className="mt-6 text-center text-sm text-muted">Pas encore de compte ? <Link to="/inscription" className="font-semibold text-link">S'inscrire</Link></p>
    </Shell>
  )
}

type F = Record<string, string>
const STEPS = [
  { title: 'Toi', icon: 'user' as const, fields: ['first_name', 'last_name', 'username'] },
  { title: 'Ton campus', icon: 'school' as const, fields: ['school', 'field_of_study', 'promotion', 'invite_code'] },
  { title: 'Accès', icon: 'lock' as const, fields: ['email', 'password', 'confirm'] },
]
const PROMOS = ['L1', 'L2', 'L3', 'M1', 'M2', 'Doctorat', 'Autre']

function validate(step: number, f: F): F {
  const e: F = {}
  const req = (k: string, m: string) => { if (!f[k]?.trim()) e[k] = m }
  if (step === 0) {
    req('first_name', 'Indique ton prénom'); req('last_name', 'Indique ton nom'); req('username', 'Choisis un pseudo')
    if (f.username && !/^[\w.@+-]{3,30}$/.test(f.username)) e.username = '3 à 30 caractères : lettres, chiffres, . _ -'
  } else if (step === 1) {
    req('school', 'Indique ton établissement'); req('field_of_study', 'Indique ta filière'); req('promotion', 'Choisis ta promotion')
  } else {
    if (!/^\S+@\S+\.\S+$/.test(f.email ?? '')) e.email = 'Adresse e-mail invalide'
    if ((f.password ?? '').length < 8) e.password = '8 caractères minimum'
    else if (passwordStrength(f.password) < 2) e.password = 'Mot de passe trop faible : ajoute des chiffres ou des majuscules'
    if (f.confirm !== f.password) e.confirm = 'Les mots de passe ne correspondent pas'
  }
  return e
}

export function Register() {
  const { register } = useAuth()
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [f, setF] = useState<F>({ promotion: '', invite_code: '' })
  const [errs, setErrs] = useState<F>({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: string) => (e: { target: { value: string } }) => { setF({ ...f, [k]: e.target.value }); if (errs[k]) setErrs({ ...errs, [k]: '' }) }

  function next() {
    const e = validate(step, f)
    setErrs(e)
    if (Object.keys(e).length === 0) setStep(step + 1)
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    if (step < 2) return next()
    const e = validate(2, f)
    setErrs(e)
    if (Object.keys(e).length) return
    setBusy(true); setErr('')
    const { confirm: _c, ...data } = f
    try { await register(data); nav('/') }
    catch (x) {
      if (x instanceof ApiError && x.data && typeof x.data === 'object') {  // map server errors back onto fields / steps
        const m: F = {}
        for (const [k, v] of Object.entries(x.data)) m[k] = [v].flat().join(' ')
        setErrs(m)
        const bad = STEPS.findIndex((s) => s.fields.some((k) => m[k]))
        if (bad >= 0) setStep(bad); else setErr(x.text)
      } else setErr('Serveur injoignable.')
    } finally { setBusy(false) }
  }

  return (
    <Shell tab="register">
      <ol className="mb-6 flex items-center gap-2" aria-label="Étapes">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex flex-1 items-center gap-2" aria-current={i === step ? 'step' : undefined}>
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${i < step ? 'bg-accent text-bg' : i === step ? 'bg-primary text-primary-fg' : 'bg-soft text-muted'}`}>
              {i < step ? <Icon name="check" bold size={18} /> : i + 1}
            </span>
            <span className={`text-xs font-semibold ${i === step ? 'text-fg' : 'text-muted'}`}>{s.title}</span>
            {i < STEPS.length - 1 && <span className={`h-px flex-1 ${i < step ? 'bg-accent' : 'bg-line'}`} />}
          </li>
        ))}
      </ol>

      <form onSubmit={submit} className="space-y-4" noValidate>
        {step === 0 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom" icon="user" value={f.first_name ?? ''} onChange={set('first_name')} error={errs.first_name} autoComplete="given-name" required />
              <Field label="Nom" value={f.last_name ?? ''} onChange={set('last_name')} error={errs.last_name} autoComplete="family-name" required />
            </div>
            <Field label="Pseudo" icon="id" value={f.username ?? ''} onChange={set('username')} error={errs.username} hint="Visible par les autres étudiants" autoComplete="username" required />
          </>
        )}
        {step === 1 && (
          <>
            <Field label="Établissement" icon="building" value={f.school ?? ''} onChange={set('school')} error={errs.school} placeholder="EIG Bénin" required />
            <Field label="Filière" icon="school" value={f.field_of_study ?? ''} onChange={set('field_of_study')} error={errs.field_of_study} placeholder="Génie logiciel" required />
            <SelectField label="Promotion" icon="users" value={f.promotion ?? ''} onChange={set('promotion')} error={errs.promotion} required>
              <option value="" disabled>Choisir…</option>
              {PROMOS.map((p) => <option key={p} value={p}>{p}</option>)}
            </SelectField>
            <Field label="Code d'invitation" icon="key" value={f.invite_code ?? ''} onChange={set('invite_code')} error={errs.invite_code}
              hint="Fourni par ton école. Sans code valide, ton compte sera vérifié par un administrateur." autoCapitalize="characters" />
          </>
        )}
        {step === 2 && (
          <>
            <Field label="Adresse e-mail" icon="mail" type="email" value={f.email ?? ''} onChange={set('email')} error={errs.email} autoComplete="email" placeholder="toi@ecole.bj" required />
            <Field label="Mot de passe" icon="lock" type="password" value={f.password ?? ''} onChange={set('password')} error={errs.password} autoComplete="new-password" required />
            <StrengthMeter value={f.password ?? ''} />
            <Field label="Confirmer le mot de passe" icon="shield" type="password" value={f.confirm ?? ''} onChange={set('confirm')} error={errs.confirm} autoComplete="new-password" required />
          </>
        )}
        <ErrorBox>{err}</ErrorBox>
        <div className="flex gap-3 pt-1">
          {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className="btn-outline !w-auto px-5" aria-label="Étape précédente"><Icon name="back" size={20} /></button>}
          {step < 2
            ? <button type="button" onClick={next} className="btn flex items-center justify-center gap-2">Continuer <Icon name="next" size={18} /></button>
            : <Submit busy={busy} icon="userPlus">Créer mon compte</Submit>}
        </div>
      </form>
      <p className="mt-6 text-center text-sm text-muted">Déjà inscrit ? <Link to="/connexion" className="font-semibold text-link">Se connecter</Link></p>
    </Shell>
  )
}

export function Forgot() {
  const [step, setStep] = useState<'email' | 'code' | 'done'>('email')
  const [f, setF] = useState<F>({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      if (step === 'email') { await api('/auth/forgot-password/', { body: { email: f.email } }); setStep('code') }
      else { await api('/auth/reset-password/', { body: { code: f.code, password: f.password } }); setStep('done') }
    } catch (x) { setErr(x instanceof ApiError ? x.data?.detail ?? (Array.isArray(x.data) ? x.data.join(' ') : x.text) : 'Serveur injoignable.') }
    finally { setBusy(false) }
  }

  return (
    <Shell>
      <h1 className="text-xl font-bold">Mot de passe oublié</h1>
      {step === 'done' ? (
        <div className="mt-6 space-y-4 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/15 text-accent"><Icon name="check" bold size={32} /></span>
          <p>Mot de passe modifié.</p><Link to="/connexion" className="btn block">Se connecter</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
          {step === 'email' ? (
            <>
              <p className="text-sm text-muted">Indique ton adresse e-mail : nous t'enverrons un code de réinitialisation.</p>
              <Field label="Adresse e-mail" icon="mail" type="email" value={f.email ?? ''} onChange={(e) => setF({ ...f, email: e.target.value })} required />
            </>
          ) : (
            <>
              <p className="text-sm text-muted">Si ce compte existe, un code a été envoyé par e-mail.</p>
              <Field label="Code reçu" icon="key" value={f.code ?? ''} onChange={(e) => setF({ ...f, code: e.target.value })} required />
              <Field label="Nouveau mot de passe" icon="lock" type="password" value={f.password ?? ''} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" required />
              <StrengthMeter value={f.password ?? ''} />
            </>
          )}
          <ErrorBox>{err}</ErrorBox>
          <Submit busy={busy} disabled={step === 'email' ? !f.email : !f.code || !f.password}>{step === 'email' ? 'Envoyer le code' : 'Changer le mot de passe'}</Submit>
        </form>
      )}
      <Link to="/connexion" className="mt-6 flex items-center justify-center gap-1 text-sm font-semibold text-link"><Icon name="back" size={16} /> Retour à la connexion</Link>
    </Shell>
  )
}
