import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import Icon from './components/Icon'

/** "Mode gratuit" = low-data mode: no photo is downloaded until the user taps it. "Mode payant" = everything loads. */
const KEY = 'campus-data-mode'
interface Ctx { free: boolean; setFree: (v: boolean) => void }
const DataCtx = createContext<Ctx>({ free: false, setFree: () => {} })
export const useDataMode = () => useContext(DataCtx)

export function DataModeProvider({ children }: { children: ReactNode }) {
  const [free, setFreeState] = useState(() => { try { return localStorage.getItem(KEY) === 'free' } catch { return false } })
  const setFree = (v: boolean) => { setFreeState(v); try { localStorage.setItem(KEY, v ? 'free' : 'paid') } catch { /* storage blocked */ } }
  return <DataCtx.Provider value={{ free, setFree }}>{children}</DataCtx.Provider>
}

/** Image that respects the data mode: in free mode it shows a tap-to-load placeholder instead of downloading. */
export function Img({ src, alt = '', className = '', loadLabel = 'Afficher la photo' }: { src: string; alt?: string; className?: string; loadLabel?: string }) {
  const { free } = useDataMode()
  const [forced, setForced] = useState(false)
  useEffect(() => { setForced(false) }, [src])
  if (free && !forced) {
    return (
      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setForced(true) }}
        className={`flex flex-col items-center justify-center gap-1 bg-soft text-xs font-semibold text-muted ${className}`} aria-label={loadLabel}>
        <Icon name="download" size={26} />{loadLabel}
      </button>
    )
  }
  return <img src={src} alt={alt} loading="lazy" className={className} />
}

/** Background photos (banners, hero) are skipped entirely in free mode. */
export function useBackgrounds() { return !useDataMode().free }
