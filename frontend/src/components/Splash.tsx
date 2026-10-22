import { useEffect, useState } from 'react'
import { useAuth } from '../auth'

const MIN_MS = 4300     // the whole little story: run in, brake, gesture, title
const MAX_MS = 9000     // never block the app longer than this
const OUT_MS = 800

// Geometry of the glove overlays inside the mascot sprite (see scripts used to cut them from the logo).
const LEFT = { left: 1.5, top: 55.2, width: 20.5, height: 30.3, origin: '85% 75%' }
const RIGHT = { left: 74.9, top: 67.2, width: 22.8, height: 28, origin: '15% 70%' }

/** Launch screen shown on every start: the logo's mascot runs in, skids to a stop, waves/points with both hands and says hi
 *  while the app loads; when everything is ready the screen irises out onto the site. Tap to skip. Honors reduced motion. */
export default function Splash() {
  const { loading } = useAuth()
  const [phase, setPhase] = useState<'in' | 'out' | 'done'>('in')
  const [minDone, setMinDone] = useState(false)

  // Design/QA helper: /?splash-t=2700 freezes the animation at 2.7 s so a frame can be inspected.
  const freeze = new URLSearchParams(location.search).get('splash-t')
  useEffect(() => {
    if (!freeze) return
    const t = setTimeout(() => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = Number(freeze) }), 80)
    return () => clearTimeout(t)
  }, [freeze])
  useEffect(() => {
    if (freeze) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const a = setTimeout(() => setMinDone(true), reduce ? 700 : MIN_MS)
    const b = setTimeout(() => setPhase((p) => (p === 'in' ? 'out' : p)), MAX_MS)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [])
  useEffect(() => { if (!freeze && minDone && !loading) setPhase((p) => (p === 'in' ? 'out' : p)) }, [minDone, loading])
  useEffect(() => {
    if (phase !== 'out') return
    const t = setTimeout(() => setPhase('done'), OUT_MS)
    return () => clearTimeout(t)
  }, [phase])

  if (phase === 'done') return null
  const out = phase === 'out'
  const glove = (g: typeof LEFT, src: string, anim: string, delay: string) => (
    <img src={src} alt="" draggable={false} className="absolute select-none"
      style={{ left: `${g.left}%`, top: `${g.top}%`, width: `${g.width}%`, height: `${g.height}%`, transformOrigin: g.origin, animation: `sp-${anim} 1.25s ease-in-out ${delay} both` }} />
  )

  return (
    <div className="splash fixed inset-0 z-[100] overflow-hidden" role="status" aria-label="Chargement d'EIG Vibes" onClick={() => setPhase('out')}
      style={{ background: 'radial-gradient(circle at 50% 42%, #14064c 0%, #0d0340 50%, #070224 100%)', animation: out ? `sp-iris ${OUT_MS}ms cubic-bezier(.7,0,.3,1) forwards` : undefined }}>
      {/* speed lines + ground */}
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="absolute h-[3px] rounded-full bg-gradient-to-r from-transparent to-fuchsia-300/70" aria-hidden
          style={{ top: `${36 + i * 5}%`, width: `${22 + (i % 3) * 10}vw`, left: 0, animation: `sp-speed 1.5s ease-out ${0.05 * i}s both` }} />
      ))}

      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ animation: out ? `sp-jump ${OUT_MS}ms ease-in forwards` : undefined }}>
        {/* run-in wrapper */}
        <div className="relative w-[min(80vw,380px)]" style={{ animation: 'sp-run 1.5s cubic-bezier(.15,.7,.3,1) both' }}>
          {/* dust puffs behind the feet */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="absolute rounded-full bg-violet-300/60 blur-[2px]" aria-hidden
              style={{ left: `${6 + i * 3}%`, bottom: '2%', width: 14 + (i % 3) * 8, height: 14 + (i % 3) * 8, animation: `sp-dust .9s ease-out ${0.2 + i * 0.22}s both` }} />
          ))}
          <div style={{ animation: 'sp-brake .55s ease-out 1.45s both' }}>
            <div className="relative" style={{ aspectRatio: '780 / 475', animation: 'sp-hop .36s ease-in-out 0s 4 both' }}>
              <div style={{ animation: 'sp-sway 1.6s ease-in-out 1.9s 2 both' }} className="absolute inset-0">
                <img src="/img/mascot-run.png" alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" style={{ WebkitMaskImage: 'radial-gradient(ellipse at 50% 50%, #000 58%, transparent 92%)', maskImage: 'radial-gradient(ellipse at 50% 50%, #000 58%, transparent 92%)' }} />
                {glove(LEFT, '/img/hand-l.png', 'wave-l', '1.95s')}
                {glove(RIGHT, '/img/hand-r.png', 'wave-r', '2.1s')}
              </div>
              <span className="absolute -top-[4%] right-[0%] origin-bottom-left rounded-2xl rounded-bl-sm bg-white px-3.5 py-1.5 text-[15px] font-black text-violet-700 shadow-xl"
                style={{ animation: 'sp-bubble .5s cubic-bezier(.2,1.6,.4,1) 1.95s both' }}>Salut&nbsp;!</span>
            </div>
          </div>
          <span className="mx-auto mt-1 block h-3 w-3/5 rounded-[50%] bg-black/50 blur-md" aria-hidden style={{ animation: 'sp-shadow .36s ease-in-out 0s 4 both' }} />
        </div>

        <h1 className="mt-5 flex text-[46px] font-black italic leading-none tracking-tight" aria-label="EIG Vibes">
          {'EIG Vibes'.split('').map((c, i) => (
            <span key={i} aria-hidden className={i < 3 ? 'text-white' : 'bg-gradient-to-b from-fuchsia-300 to-violet-400 bg-clip-text text-transparent'}
              style={{ display: 'inline-block', whiteSpace: 'pre', animation: `sp-letter .5s cubic-bezier(.2,1.6,.4,1) ${2.35 + i * 0.07}s both` }}>{c}</span>
          ))}
        </h1>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[.22em] text-violet-200/80" style={{ animation: 'sp-fade .6s ease-out 3s both' }}>Le réseau social des étudiants de l'EIG Bénin</p>

        <div className="mt-6 h-1.5 w-44 overflow-hidden rounded-full bg-white/15" aria-hidden>
          <div className="h-full origin-left rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-amber-300" style={{ animation: `sp-bar ${MIN_MS}ms cubic-bezier(.5,0,.2,1) both` }} />
        </div>
        <p className="mt-2 text-[11px] font-semibold tracking-[.25em] text-violet-200/70">CHARGEMENT…</p>
      </div>
    </div>
  )
}
