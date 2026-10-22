import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, getToken, setToken, type User } from './api'
import { useTheme, type ThemeMode } from './theme'

interface AuthCtx {
  user: User | null; loading: boolean
  login: (login: string, password: string) => Promise<void>
  register: (data: Record<string, string>) => Promise<void>
  logout: () => Promise<void>
  saveTheme: (m: ThemeMode) => void
  update: (patch: Partial<User>) => Promise<void>
}
const Ctx = createContext<AuthCtx>(null as never)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setMode } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(!!getToken())

  const accept = (r: { token: string; user: User }) => { setToken(r.token); setUser(r.user); setMode(r.user.theme) }

  useEffect(() => {
    if (!getToken()) return
    api<User>('/auth/me/')
      .then((u) => { setUser(u); setMode(u.theme) })
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [setMode])

  const value: AuthCtx = {
    user, loading,
    login: async (login, password) => accept(await api('/auth/login/', { body: { login, password } })),
    register: async (data) => accept(await api('/auth/register/', { body: data })),
    logout: async () => { await api('/auth/logout/', { method: 'POST' }).catch(() => {}); setToken(null); setUser(null) },
    // Theme applies instantly and is synced to the account when logged in.
    saveTheme: (m) => {
      setMode(m)
      if (user) api<User>('/auth/me/', { method: 'PATCH', body: { theme: m } }).then(setUser).catch(() => {})
    },
    update: async (patch) => setUser(await api<User>('/auth/me/', { method: 'PATCH', body: patch })),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
