import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark' | 'auto'
const KEY = 'campus-theme'
const read = (): ThemeMode => {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' || v === 'auto' ? v : 'light' } catch { return 'light' }
}

const Ctx = createContext<{ mode: ThemeMode; setMode: (m: ThemeMode) => void }>({ mode: 'light', setMode: () => {} })
export const useTheme = () => useContext(Ctx)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(read)

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => document.documentElement.classList.toggle('dark', mode === 'dark' || (mode === 'auto' && mq.matches))
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [mode])

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m)
    try { localStorage.setItem(KEY, m) } catch { /* storage blocked */ }
  }, [])

  return <Ctx.Provider value={{ mode, setMode }}>{children}</Ctx.Provider>
}
