import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getSettings, loginUser, logoutUser, type AuthUser, type UserRole } from '../services/api'

const STORAGE_KEY = 'velenito-session-user'

export type AuthContextValue = {
  operator: AuthUser | null
  isAuthenticated: boolean
  authNotice: string
  clearAuthNotice: () => void
  login: (usuario: string, contrasena: string) => Promise<AuthUser>
  enterDevPreview?: (rol?: UserRole) => void
  logout: () => Promise<void>
  refreshSession: () => Promise<boolean>
  hasRole: (...roles: UserRole[]) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthUser
    if (parsed?.id && parsed?.usuario && ['administrador', 'tendero', 'cajero'].includes(parsed?.rol)) {
      return parsed
    }
  } catch {
    // Ignorar errores de almacenamiento
  }
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [operator, setOperator] = useState<AuthUser | null>(readStoredUser)
  const [authNotice, setAuthNotice] = useState('')

  const persistUser = useCallback((user: AuthUser | null) => {
    setOperator(user)
    try {
      if (user) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user))
      else sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignorar si el navegador restringe sessionStorage
    }
  }, [])

  const login = useCallback(async (usuario: string, contrasena: string) => {
    const user = await loginUser(usuario, contrasena)
    if (!['administrador', 'tendero', 'cajero'].includes(user.rol) || !user.activo) {
      throw new Error('El usuario no tiene un rol activo autorizado para operar la caja.')
    }
    setAuthNotice('')
    persistUser(user)
    return user
  }, [persistUser])

  const enterDevPreview = useCallback((rol: UserRole = 'administrador') => {
    if (!import.meta.env.DEV) return
    setAuthNotice('')
    persistUser({
      id: 'dev-preview',
      nombre: 'Vista de administrador',
      usuario: 'admin-demo',
      rol,
      activo: true,
    })
  }, [persistUser])

  const logout = useCallback(async () => {
    setAuthNotice('')
    try {
      await logoutUser()
    } catch (failure) {
      setAuthNotice(failure instanceof Error
        ? `Se cerró la sesión local, pero no se pudo confirmar el cierre en el servidor: ${failure.message}`
        : 'Se cerró la sesión local, pero no se pudo confirmar el cierre en el servidor.')
    } finally {
      persistUser(null)
    }
  }, [persistUser])

  const refreshSession = useCallback(async () => {
    try {
      const settings = await getSettings()
      const current = readStoredUser()
      if (current) {
        persistUser({
          ...current,
          nombre: settings.operador,
          usuario: settings.usuario,
          rol: settings.rol,
        })
      }
      return true
    } catch {
      persistUser(null)
      return false
    }
  }, [persistUser])

  const hasRole = useCallback(
    (...roles: UserRole[]) => !!operator && roles.includes(operator.rol),
    [operator],
  )

  useEffect(() => {
    const onUnauthorized = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      persistUser(null)
      setAuthNotice(detail || 'Tu sesión expiró. Inicia sesión nuevamente.')
    }
    const onForbidden = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      setAuthNotice(detail || 'Tu rol no tiene permiso para acceder a este módulo.')
    }
    window.addEventListener('velenito:unauthorized', onUnauthorized)
    window.addEventListener('velenito:forbidden', onForbidden)
    return () => {
      window.removeEventListener('velenito:unauthorized', onUnauthorized)
      window.removeEventListener('velenito:forbidden', onForbidden)
    }
  }, [persistUser])

  useEffect(() => {
    if (operator) void refreshSession()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      operator,
      isAuthenticated: !!operator,
      authNotice,
      clearAuthNotice: () => setAuthNotice(''),
      login,
      ...(import.meta.env.DEV ? { enterDevPreview } : {}),
      logout,
      refreshSession,
      hasRole,
    }),
    [operator, authNotice, login, enterDevPreview, logout, refreshSession, hasRole],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}