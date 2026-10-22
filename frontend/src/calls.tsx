import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { api, ApiError, type PublicUser } from './api'
import Icon from './components/Icon'
import { Avatar } from './components/ui'

export interface CallInfo {
  id: number; conversation: number; kind: 'audio' | 'video'; status: 'ringing' | 'active' | 'ended' | 'declined' | 'missed'
  incoming: boolean; other: PublicUser
}
type Phase = 'ringing' | 'connecting' | 'active' | 'ended'

interface Ctx { start: (conversation: number, kind: 'audio' | 'video') => Promise<string | null>; busy: boolean }
const CallCtx = createContext<Ctx>({ start: async () => null, busy: false })
export const useCalls = () => useContext(CallCtx)

function mediaError(x: unknown) {
  const n = x instanceof DOMException ? x.name : ''
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'Autorise le micro (et la caméra) dans ton navigateur pour passer des appels.'
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'Aucun micro ou aucune caméra détecté.'
  if (n === 'NotReadableError') return 'Le micro ou la caméra est utilisé par une autre application.'
  return x instanceof Error ? x.message : 'Micro ou caméra indisponible.'
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** WebRTC (peer-to-peer media). The Django API only relays offer/answer/ICE by polling, so no WebSocket server is needed. */
export function CallProvider({ children }: { children: ReactNode }) {
  const [incoming, setIncoming] = useState<CallInfo | null>(null)
  const [call, setCall] = useState<CallInfo | null>(null)
  const [phase, setPhase] = useState<Phase>('ringing')
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const pc = useRef<RTCPeerConnection | null>(null)
  const local = useRef<MediaStream | null>(null)
  const localVideo = useRef<HTMLVideoElement>(null)
  const remoteVideo = useRef<HTMLVideoElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const poll = useRef<number | undefined>(undefined)
  const lastSignal = useRef(0)
  const pendingIce = useRef<RTCIceCandidateInit[]>([])
  const callRef = useRef<CallInfo | null>(null)

  const cleanup = useCallback(() => {
    window.clearInterval(poll.current); window.clearInterval(timer.current)
    local.current?.getTracks().forEach((t) => t.stop()); local.current = null
    pc.current?.close(); pc.current = null
    pendingIce.current = []; lastSignal.current = 0; callRef.current = null
    setSeconds(0); setMuted(false); setCamOff(false)
  }, [])

  const finish = useCallback((msg = '') => {
    cleanup(); setPhase('ended'); setError(msg)
    window.setTimeout(() => { setCall(null); setError('') }, msg ? 2500 : 600)
  }, [cleanup])

  const setup = useCallback(async (c: CallInfo) => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Les appels nécessitent une connexion sécurisée (HTTPS) et un navigateur compatible.')
    const { iceServers } = await api<{ iceServers: RTCIceServer[] }>('/calls/ice-servers/')
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: c.kind === 'video' })
    local.current = stream
    const conn = new RTCPeerConnection({ iceServers })
    pc.current = conn
    stream.getTracks().forEach((t) => conn.addTrack(t, stream))
    conn.onicecandidate = (e) => { if (e.candidate) api(`/calls/${c.id}/signal/`, { body: { type: 'candidate', payload: e.candidate.toJSON() } }).catch(() => {}) }
    conn.ontrack = (e) => { if (remoteVideo.current) remoteVideo.current.srcObject = e.streams[0] }
    conn.onconnectionstatechange = () => {
      if (conn.connectionState === 'connected') {
        setPhase('active'); window.clearInterval(timer.current)
        timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000)
      } else if (conn.connectionState === 'failed') { api(`/calls/${c.id}/end/`, { method: 'POST' }).catch(() => {}); finish('Connexion impossible (réseau trop restrictif ?).') }
    }
    if (localVideo.current) localVideo.current.srcObject = stream
  }, [finish])

  // Signalling loop: fetch the other side's offer/answer/candidates and watch for hang-up.
  const startPolling = useCallback((c: CallInfo) => {
    let offerSent = false
    window.clearInterval(poll.current)
    poll.current = window.setInterval(async () => {
      const conn = pc.current
      if (!conn || callRef.current?.id !== c.id) return
      try {
        const r = await api<{ status: CallInfo['status']; signals: { id: number; type: string; payload: any }[] }>(`/calls/${c.id}/signals/?after=${lastSignal.current}`)
        if (['ended', 'declined', 'missed'].includes(r.status)) { finish(r.status === 'declined' ? 'Appel refusé' : r.status === 'missed' ? 'Pas de réponse' : ''); return }
        if (!c.incoming && r.status === 'active' && !offerSent) {  // callee picked up: caller sends the offer
          offerSent = true
          const offer = await conn.createOffer(); await conn.setLocalDescription(offer)
          await api(`/calls/${c.id}/signal/`, { body: { type: 'offer', payload: offer } })
          setPhase('connecting')
        }
        for (const s of r.signals) {
          lastSignal.current = s.id
          if (s.type === 'offer' && c.incoming) {
            await conn.setRemoteDescription(s.payload)
            const ans = await conn.createAnswer(); await conn.setLocalDescription(ans)
            await api(`/calls/${c.id}/signal/`, { body: { type: 'answer', payload: ans } })
            setPhase('connecting')
          } else if (s.type === 'answer' && !c.incoming) await conn.setRemoteDescription(s.payload)
          else if (s.type === 'candidate') { if (conn.remoteDescription) await conn.addIceCandidate(s.payload).catch(() => {}); else pendingIce.current.push(s.payload) }
          if (conn.remoteDescription && pendingIce.current.length) { const q = pendingIce.current.splice(0); for (const i of q) await conn.addIceCandidate(i).catch(() => {}) }
        }
      } catch { /* transient network error: keep polling */ }
    }, 900)
  }, [finish])

  const start = useCallback(async (conversation: number, kind: 'audio' | 'video') => {
    if (callRef.current) return 'Un appel est déjà en cours.'
    try {
      const c = await api<CallInfo>(`/conversations/${conversation}/call/`, { body: { kind } })
      callRef.current = c; setCall(c); setPhase('ringing'); setError('')
      try { await setup(c) } catch (x) { await api(`/calls/${c.id}/end/`, { method: 'POST' }).catch(() => {}); finish(mediaError(x)); return null }
      startPolling(c)
      return null
    } catch (x) { return x instanceof ApiError ? (x.data?.detail ?? x.text) : 'Appel impossible.' }
  }, [setup, startPolling, finish])

  async function answer() {
    if (!incoming) return
    const c = incoming
    setIncoming(null); callRef.current = c; setCall(c); setPhase('connecting')
    try { await setup(c); await api(`/calls/${c.id}/answer/`, { method: 'POST' }); startPolling(c) }
    catch (x) { await api(`/calls/${c.id}/decline/`, { method: 'POST' }).catch(() => {}); finish(mediaError(x)) }
  }
  async function decline() { if (incoming) { await api(`/calls/${incoming.id}/decline/`, { method: 'POST' }).catch(() => {}); setIncoming(null) } }
  async function hangup() { if (call) { await api(`/calls/${call.id}/end/`, { method: 'POST' }).catch(() => {}); finish() } }

  // Incoming calls: light polling while idle.
  useEffect(() => {
    const t = window.setInterval(async () => {
      if (callRef.current) return
      try { const r = await api<CallInfo[]>('/calls/incoming/'); setIncoming((cur) => (r[0] ?? null) && (cur?.id === r[0].id ? cur : r[0])) } catch { /* offline */ }
    }, 3000)
    return () => window.clearInterval(t)
  }, [])
  useEffect(() => () => cleanup(), [cleanup])

  function toggleMute() { const t = local.current?.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; setMuted(!t.enabled) } }
  function toggleCam() { const t = local.current?.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; setCamOff(!t.enabled) } }

  const label = error || (phase === 'ringing' ? (call?.incoming ? 'Connexion…' : 'Appel en cours…') : phase === 'connecting' ? 'Connexion…' : phase === 'active' ? fmt(seconds) : 'Appel terminé')
  const ctl = 'grid h-14 w-14 place-items-center rounded-full text-white'
  return (
    <CallCtx.Provider value={{ start, busy: !!call }}>
      {children}
      {incoming && !call && (
        <div role="alertdialog" aria-label="Appel entrant" className="fixed inset-x-3 top-3 z-[60] mx-auto max-w-md rounded-xl2 border border-line bg-card p-4 shadow-2xl">
          <div className="flex items-center gap-3">
            <Avatar user={incoming.other} size={48} />
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{incoming.other.first_name} {incoming.other.last_name}</p>
              <p className="text-sm text-muted">Appel {incoming.kind === 'video' ? 'vidéo' : 'audio'} entrant…</p></div>
            <button onClick={decline} aria-label="Refuser" className={`${ctl} bg-danger !text-bg`}><Icon name="endCall" bold size={26} /></button>
            <button onClick={answer} aria-label="Répondre" className={`${ctl} bg-accent !text-bg`}><Icon name={incoming.kind === 'video' ? 'video' : 'phone'} bold size={26} /></button>
          </div>
        </div>
      )}
      {call && (
        <div role="dialog" aria-label="Appel" className="fixed inset-0 z-[70] flex flex-col bg-slate-950 text-white">
          <div className="relative flex-1">
            <video ref={remoteVideo} autoPlay playsInline className={`h-full w-full object-cover ${call.kind === 'video' && phase === 'active' ? '' : 'invisible'}`} />
            {!(call.kind === 'video' && phase === 'active') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4"><Avatar user={call.other} size={112} />
                <p className="text-xl font-semibold">{call.other.first_name} {call.other.last_name}</p></div>
            )}
            <p className="absolute inset-x-0 top-6 text-center text-sm text-white/80" role="status">{label}</p>
            {call.kind === 'video' && <video ref={localVideo} autoPlay playsInline muted className={`absolute bottom-4 right-4 h-36 w-24 rounded-xl border border-white/30 bg-black object-cover ${camOff ? 'opacity-30' : ''}`} />}
          </div>
          <div className="flex items-center justify-center gap-5 pb-10 pt-6">
            <button onClick={toggleMute} aria-pressed={muted} aria-label={muted ? 'Réactiver le micro' : 'Couper le micro'} className={`${ctl} ${muted ? 'bg-white text-slate-900' : 'bg-white/15'}`}><Icon name="mic" bold={muted} size={26} /></button>
            {call.kind === 'video' && <button onClick={toggleCam} aria-pressed={camOff} aria-label={camOff ? 'Activer la caméra' : 'Couper la caméra'} className={`${ctl} ${camOff ? 'bg-white text-slate-900' : 'bg-white/15'}`}><Icon name="video" bold={camOff} size={26} /></button>}
            <button onClick={hangup} aria-label="Raccrocher" className={`${ctl} bg-danger !text-bg`}><Icon name="endCall" bold size={28} /></button>
          </div>
        </div>
      )}
    </CallCtx.Provider>
  )
}
