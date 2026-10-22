import { useEffect, useMemo, useState } from 'react'

const KEY = 'eigvibes-splash-seen'
const TOTAL = 3200   // ms before the exit animation starts
const EXIT = 650

/** Launch animation (once per browser session): burst of rays, shockwaves, the logo springs in, a shine sweeps across it,
 *  sparkles float up, then the whole screen zooms through into the app. Tap anywhere to skip. Honors reduced motion. */
export default function Splash() {
  const [phase, setPhase] = useState<'in' | 'out' | 'done'>(() => {
    try { return sessionStorage.getItem(KEY) ? 'done' : 'in' } catch { return 'in' }
  })

  const sparks = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    left: 8 + ((i * 53) % 84), top: 30 + ((i * 37) % 48), delay: 0.5 + (i % 9) * 0.18, size: 6 + (i % 4) * 4, hue: i % 3,
  })), [])

  useEffect(() => {
    if (phase !== 'in') return
    try { sessionStorage.setItem(KEY, '1') } catch { /* storage blocked */ }
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const a = setTimeout(() => setPhase('out'), reduce ? 900 : TOTAL)
    return () => clearTimeout(a)
  }, [phase])
  useEffect(() => {
    if (phase !== 'out') return
    const b = setTimeout(() => setPhase('done'), EXIT)
    return () => clearTimeout(b)
  }, [phase])

  if (phase === 'done') return null
  const colors = ['#c4b5fd', '#f0abfc', '#fcd34d']
  return (
    <div className="splash fixed inset-0 z-[100] grid place-items-center overflow-hidden" role="status" aria-label="Chargement d'EIG Vibes"
      style={{ background: 'radial-gradient(circle at 50% 42%, #2b0f70 0%, #0e0540 48%, #05011a 100%)', animation: phase === 'out' ? `splash-out ${EXIT}ms ease-in forwards` : undefined }}
      onClick={() => setPhase('out')}>
      <div className="absolute left-1/2 top-[42%] h-[190vmax] w-[190vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'repeating-conic-gradient(from 0deg, rgb(168 85 247 / .38) 0deg 5deg, transparent 5deg 18deg)', WebkitMaskImage: 'radial-gradient(circle, #000 0%, transparent 38%)', maskImage: 'radial-gradient(circle, #000 0%, transparent 38%)', animation: 'splash-rays 3.6s linear forwards' }} />
      {[0, 0.35, 0.7].map((d) => (
        <span key={d} className="absolute left-1/2 top-[42%] h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-fuchsia-400/70"
          style={{ animation: `splash-ring 1.8s ease-out ${0.25 + d}s both` }} />
      ))}
      {sparks.map((s, i) => (
        <span key={i} className="absolute rounded-full" aria-hidden
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, background: colors[s.hue], boxShadow: `0 0 ${s.size * 2}px ${colors[s.hue]}`, animation: `splash-spark 2s ease-out ${s.delay}s both` }} />
      ))}

      <div className="relative -mt-8 flex flex-col items-center">
        <div className="relative overflow-hidden" style={{ animation: 'splash-pop 1.25s cubic-bezier(.2,1.3,.4,1) .15s both' }}>
          <img src="/img/logo.webp" alt="EIG Vibes — le réseau social des étudiants de l'EIG Bénin" width={420} height={420} draggable={false}
            className="block w-[min(82vw,440px)] select-none"
            style={{ WebkitMaskImage: 'radial-gradient(closest-side, #000 74%, transparent 100%)', maskImage: 'radial-gradient(closest-side, #000 74%, transparent 100%)', filter: 'drop-shadow(0 0 28px rgb(168 85 247 / .55))' }} />
          <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3" style={{ background: 'linear-gradient(100deg, transparent, rgb(255 255 255 / .55), transparent)', animation: 'splash-shine 1.1s ease-in-out 1.35s both' }} />
        </div>
        <div className="mt-4 h-1.5 w-44 overflow-hidden rounded-full bg-white/15" aria-hidden>
          <div className="h-full origin-left rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-amber-300" style={{ animation: `splash-bar ${TOTAL - 400}ms cubic-bezier(.5,0,.2,1) .2s both` }} />
        </div>
        <p className="mt-3 text-xs font-semibold tracking-[.25em] text-violet-200/80" style={{ animation: 'splash-tag .6s ease-out 1.3s both' }}>CHARGEMENT…</p>
      </div>
    </div>
  )
}
