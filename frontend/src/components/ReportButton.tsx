import { useState } from 'react'
import { api, ApiError } from '../api'

const REASONS: [string, string][] = [
  ['spam', 'Spam ou arnaque'], ['harassment', 'Harcèlement ou menaces'], ['inappropriate', 'Contenu inapproprié'],
  ['illegal', 'Produit ou contenu interdit'], ['personal', 'Informations personnelles'], ['other', 'Autre'],
]

export default function ReportButton({ type, id, label = 'Signaler' }: { type: 'post' | 'comment' | 'listing' | 'review' | 'user'; id: number; label?: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('spam')
  const [details, setDetails] = useState('')
  const [msg, setMsg] = useState('')

  async function send() {
    try { const r = await api<{ detail: string }>('/reports/', { body: { target_type: type, target_id: id, reason, details } }); setMsg(r.detail); setOpen(false) }
    catch (x) { setMsg(x instanceof ApiError ? (x.data?.detail ?? x.text) : 'Erreur') }
  }

  if (msg) return <span className="text-xs text-muted" role="status">{msg}</span>
  if (!open) return <button onClick={() => setOpen(true)} className="text-xs text-muted underline">{label}</button>
  return (
    <div className="card space-y-2 p-3 text-sm" role="group" aria-label="Signalement">
      <select className="field !py-2" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Motif">
        {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <input className="field !py-2" placeholder="Précisions (facultatif)" maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} />
      <div className="flex gap-2">
        <button className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-bg" onClick={send}>Envoyer le signalement</button>
        <button className="rounded-lg border border-line px-3 py-1.5 text-xs" onClick={() => setOpen(false)}>Annuler</button>
      </div>
    </div>
  )
}
