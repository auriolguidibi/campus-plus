import { useCallback, useEffect, useState } from 'react'
import Banner from '../components/Banner'
import Icon from '../components/Icon'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError, type Challenge, type PublicUser } from '../api'
import { ErrorBox, Spinner } from '../components/ui'

const fmt = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function Challenges() {
  const [tab, setTab] = useState<'open' | 'mine' | 'closed'>('open')
  const [items, setItems] = useState<Challenge[] | null>(null)
  useEffect(() => { setItems(null); api<Challenge[]>(`/challenges/?status=${tab}`).then(setItems).catch(() => setItems([])) }, [tab])
  return (
    <div className="space-y-4 pt-6">
      <Banner title="Défis & Battles" subtitle="Relève des défis, gagne des points" icon="trophy"
        action={<Link to="/classement" className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold">Classement</Link>} />
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-soft p-1" role="tablist">
        {([['open', 'En cours'], ['mine', 'Mes participations'], ['closed', 'Terminés']] as const).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={`rounded-lg py-2 text-xs font-semibold ${tab === v ? 'bg-primary text-primary-fg' : 'text-muted'}`}>{l}</button>
        ))}
      </div>
      {items === null ? <Spinner /> : items.length === 0 ? <p className="py-8 text-center text-sm text-muted">Aucun défi ici pour le moment.</p> : (
        <div className="space-y-3">
          {items.map((c) => (
            <Link key={c.id} to={`/defis/${c.id}`} className="card block p-4">
              <div className="flex items-center justify-between text-xs text-muted"><span>{c.kind_label}</span><span>{c.max_points} pts max</span></div>
              <p className="mt-1 font-semibold">{c.title}</p>
              <p className="mt-1 text-xs text-muted">Date limite : {fmt(c.deadline)} · {c.participants} participant{c.participants > 1 ? 's' : ''}</p>
              {c.mine && <p className="mt-2 text-xs font-semibold text-accent">{c.mine.reviewed ? `Tu as obtenu ${c.mine.points} pts` : 'Participation envoyée — en attente de notation'}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

interface Submission { id: number; user: PublicUser; answer: string; image: string | null; points: number | null }

export function ChallengePage() {
  const { id } = useParams()
  const [c, setC] = useState<Challenge | null>(null)
  const [choices, setChoices] = useState<number[]>([])
  const [answer, setAnswer] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [subs, setSubs] = useState<Submission[] | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => { api<Challenge>(`/challenges/${id}/`).then((x) => { setC(x); setChoices(x.questions?.map(() => -1) ?? []) }).catch(() => setErr('Défi introuvable.')) }, [id])
  useEffect(load, [load])
  const loadSubs = useCallback(() => { api<Submission[]>(`/challenges/${id}/submissions/`).then(setSubs).catch(() => {}) }, [id])
  useEffect(() => { if (c?.can_manage) loadSubs() }, [c?.can_manage, loadSubs])

  if (!c) return err ? <p className="pt-10 text-center text-muted">{err}</p> : <div className="py-10"><Spinner /></div>

  async function submit() {
    setBusy(true); setErr('')
    try {
      const fd = new FormData()
      if (c!.auto_graded) fd.append('choices', JSON.stringify(choices)); else fd.append('answer', answer)
      if (file) fd.append('image', file)
      await api(`/challenges/${id}/participate/`, { body: fd }); load()
    } catch (x) { setErr(x instanceof ApiError ? (x.data?.detail ?? x.text) : 'Serveur injoignable.') } finally { setBusy(false) }
  }
  async function review(pid: number) {
    const v = prompt(`Points (0 à ${c!.max_points})`)
    if (v === null) return
    try { await api(`/participations/${pid}/review/`, { body: { points: Number(v) } }); loadSubs() } catch (x) { setErr(x instanceof ApiError ? x.text : 'Erreur') }
  }

  return (
    <div className="space-y-4 pt-6">
      <Link to="/defis" className="inline-flex items-center gap-1 text-sm font-semibold text-link"><Icon name="back" size={18} /> Défis</Link>
      <header>
        <p className="text-xs text-muted">{c.kind_label} · {c.max_points} points maximum</p>
        <h1 className="text-xl font-bold">{c.title}</h1>
        <p className="text-xs text-muted">Du {fmt(c.starts_at)} au {fmt(c.deadline)}</p>
      </header>
      <p className="whitespace-pre-wrap text-sm">{c.description}</p>
      {c.rules && <p className="card whitespace-pre-wrap p-3 text-sm"><b>Règles</b><br />{c.rules}</p>}
      <p className="text-xs text-muted">{c.auto_graded ? 'Quiz corrigé automatiquement par le serveur.' : 'Réponse notée par un organisateur.'}</p>

      {c.mine ? (
        <section className="card space-y-1 p-4 text-sm">
          <p className="font-semibold">Ta participation</p>
          {c.mine.reviewed ? <p className="text-accent">Résultat : {c.mine.points} / {c.max_points} points</p> : <p className="text-muted">En attente de notation.</p>}
          {!c.auto_graded && c.mine.answer && <p className="whitespace-pre-wrap">{c.mine.answer}</p>}
          {c.mine.image && <img src={c.mine.image} alt="" className="max-h-60 rounded-lg" />}
        </section>
      ) : c.is_open ? (
        <section className="space-y-3">
          {c.auto_graded ? c.questions?.map((q, qi) => (
            <fieldset key={qi} className="card space-y-2 p-3">
              <legend className="px-1 text-sm font-semibold">{qi + 1}. {q.q}</legend>
              {q.options.map((o, oi) => (
                <label key={oi} className="flex items-center gap-2 text-sm"><input type="radio" name={`q${qi}`} checked={choices[qi] === oi} onChange={() => setChoices(choices.map((x, k) => (k === qi ? oi : x)))} /> {o}</label>
              ))}
            </fieldset>
          )) : (
            <>
              <textarea className="field min-h-28" placeholder="Ta réponse" maxLength={3000} value={answer} onChange={(e) => setAnswer(e.target.value)} />
              <label className="btn-outline flex cursor-pointer items-center justify-center gap-2"><Icon name="gallery" size={20} /> {file ? file.name : 'Joindre une photo'}<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
            </>
          )}
          <ErrorBox>{err}</ErrorBox>
          <button className="btn" onClick={submit} disabled={busy || (c.auto_graded ? choices.includes(-1) : !answer.trim() && !file)}>{busy ? 'Envoi…' : 'Envoyer ma participation (définitif pour un quiz)'}</button>
        </section>
      ) : <p className="text-sm text-muted">Ce défi n'est pas ouvert aux participations.</p>}

      {c.can_manage && subs && (
        <section className="space-y-2">
          <h2 className="font-semibold">Participations ({subs.length})</h2>
          {subs.map((s) => (
            <div key={s.id} className="card space-y-1 p-3 text-sm">
              <p className="font-semibold">@{s.user.username} {s.points !== null && <span className="text-accent">· {s.points} pts</span>}</p>
              {s.answer && <p className="whitespace-pre-wrap">{s.answer}</p>}
              {s.image && <img src={s.image} alt="" className="max-h-48 rounded-lg" />}
              {!c.auto_graded && <button className="text-link" onClick={() => review(s.id)}>{s.points === null ? 'Noter' : 'Modifier la note'}</button>}
            </div>
          ))}
          <ErrorBox>{err}</ErrorBox>
        </section>
      )}
    </div>
  )
}
