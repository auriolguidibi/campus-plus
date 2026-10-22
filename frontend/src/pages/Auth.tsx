import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import { ErrorBox, Logo } from '../components/ui'

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10 pt-safe pb-safe">
      <div className="mb-6 flex flex-col items-center gap-1 text-center">
        <Logo size={48} />
        <p className="text-sm text-muted">Ton école. Tes amis. Tes délires.</p>
      </div>
      {children}
    </div>
  )
}

export function Welcome() {
  return (
    <Screen>
      <div className="mt-8 space-y-3">
        <Link to="/connexion" className="btn block text-center">Se connecter</Link>
        <Link to="/inscription" className="btn-outline block text-center">Créer un compte</Link>
      </div>
      <p className="mt-6 text-center text-xs text-muted">Rejoins la communauté des étudiants de ton école !</p>
    </Screen>
  )
}

export function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true); setErr('')
    try { await login(String(f.get('login')), String(f.get('password'))); nav('/') }
    catch (x) { setErr(x instanceof ApiError ? (x.status === 429 ? 'Trop de tentatives, réessaie dans une minute.' : x.text) : 'Serveur injoignable.') }
    finally { setBusy(false) }
  }

  return (
    <Screen>
      <form onSubmit={submit} className="space-y-3">
        <input name="login" className="field" placeholder="E-mail ou pseudo" autoComplete="username" required />
        <input name="password" type="password" className="field" placeholder="Mot de passe" autoComplete="current-password" required />
        <ErrorBox>{err}</ErrorBox>
        <button className="btn" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
      </form>
      <Link to="/mot-de-passe-oublie" className="mt-4 text-center text-sm text-primary">Mot de passe oublié ?</Link>
      <p className="mt-4 text-center text-sm text-muted">Pas encore de compte ? <Link to="/inscription" className="font-semibold text-primary">S'inscrire</Link></p>
    </Screen>
  )
}

const FIELDS: [string, string, string?][] = [
  ['first_name', 'Prénom'], ['last_name', 'Nom'], ['username', 'Pseudo', 'username'], ['email', 'Adresse e-mail', 'email'],
  ['school', 'Établissement'], ['field_of_study', 'Filière'], ['promotion', 'Promotion (ex. L1, 2026)'],
]

export function Register() {
  const { register } = useAuth()
  const nav = useNavigate()
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    if (data.password !== data.confirm) { setErr('Les mots de passe ne correspondent pas.'); return }
    delete data.confirm
    setBusy(true); setErr('')
    try { await register(data); nav('/') }
    catch (x) { setErr(x instanceof ApiError ? x.text : 'Serveur injoignable.') }
    finally { setBusy(false) }
  }

  return (
    <Screen>
      <form onSubmit={submit} className="space-y-3">
        {FIELDS.map(([name, label, type]) => (
          <input key={name} name={name} type={type === 'email' ? 'email' : 'text'} className="field" placeholder={label} required />
        ))}
        <input name="password" type="password" minLength={8} className="field" placeholder="Mot de passe (8 caractères min.)" autoComplete="new-password" required />
        <input name="confirm" type="password" className="field" placeholder="Confirmer le mot de passe" autoComplete="new-password" required />
        <input name="invite_code" className="field" placeholder="Code d'invitation de l'école (si tu en as un)" />
        <p className="text-xs text-muted">Sans code valide, ton compte reste « en attente » jusqu'à validation par un administrateur.</p>
        <ErrorBox>{err}</ErrorBox>
        <button className="btn" disabled={busy}>{busy ? 'Création…' : 'Créer mon compte'}</button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">Déjà inscrit ? <Link to="/connexion" className="font-semibold text-primary">Se connecter</Link></p>
    </Screen>
  )
}

export function Forgot() {
  const [step, setStep] = useState<'email' | 'code' | 'done'>('email')
  const [err, setErr] = useState('')

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    setErr('')
    try {
      if (step === 'email') { await api('/auth/forgot-password/', { body: { email: f.email } }); setStep('code') }
      else { await api('/auth/reset-password/', { body: { code: f.code, password: f.password } }); setStep('done') }
    } catch (x) { setErr(x instanceof ApiError ? x.data?.detail ?? (Array.isArray(x.data) ? x.data.join(' ') : x.text) : 'Serveur injoignable.') }
  }

  return (
    <Screen>
      {step === 'done' ? (
        <div className="space-y-4 text-center"><p>Mot de passe modifié.</p><Link to="/connexion" className="btn block">Se connecter</Link></div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          {step === 'email' ? (
            <input name="email" type="email" className="field" placeholder="Ton adresse e-mail" required />
          ) : (
            <>
              <p className="text-sm text-muted">Si ce compte existe, un code a été envoyé par e-mail.</p>
              <input name="code" className="field" placeholder="Code reçu" required />
              <input name="password" type="password" minLength={8} className="field" placeholder="Nouveau mot de passe" required />
            </>
          )}
          <ErrorBox>{err}</ErrorBox>
          <button className="btn">{step === 'email' ? 'Envoyer le code' : 'Changer le mot de passe'}</button>
        </form>
      )}
      <Link to="/connexion" className="mt-4 text-center text-sm text-primary">Retour à la connexion</Link>
    </Screen>
  )
}
