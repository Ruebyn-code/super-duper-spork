import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { get, post, put, setActiveLocation, setCsrf } from '../lib/api'

const SessionContext = createContext(null)

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
}

function applyAppearance(appearance) {
  if (!appearance) return
  const root = document.documentElement.style
  if (appearance.primary) root.setProperty('--primary', appearance.primary)
  if (appearance.secondary) root.setProperty('--secondary', appearance.secondary)
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [appearance, setAppearance] = useState(null)
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('opstack-theme') || 'light'
    } catch {
      return 'light'
    }
  })

  const loadSession = useCallback(async () => {
    const data = await get('/api/session')
    const signedIn = Boolean(data && data.role !== 'user')
    const next = signedIn ? data : null
    setSession(next)
    setCsrf(next?.csrf || '')
    setActiveLocation(next?.locationId || '')
    return next
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await loadSession()
      } catch {
        if (!cancelled) setSession(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadSession])

  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem('opstack-theme', theme)
    } catch {
      /* storage unavailable */
    }
  }, [theme])

  useEffect(() => {
    if (!session) return undefined
    let cancelled = false
    get('/appearance')
      .then((data) => {
        if (cancelled) return
        setAppearance(data)
        applyAppearance(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [session?.companyId])

  const signIn = useCallback(
    async ({ username, password, networkCode }) => {
      await post('/api/login', {
        username,
        password,
        ...(networkCode ? { networkCode } : {}),
      })
      const next = await loadSession()
      if (!next) throw new Error('Sign-in did not return a session.')
      return next
    },
    [loadSession],
  )

  const signOut = useCallback(async () => {
    try {
      await post('/api/logout', {})
    } finally {
      setSession(null)
      setCsrf('')
      setActiveLocation('')
    }
  }, [])

  const switchLocation = useCallback(
    async (locationId) => {
      await put('/api/session/location', { locationId })
      return loadSession()
    },
    [loadSession],
  )

  const switchCompany = useCallback(
    async (companyId) => {
      await put('/api/session/company', { companyId })
      return loadSession()
    },
    [loadSession],
  )

  const can = useCallback(
    (permission) => Boolean(permission && session?.permissions?.includes(permission)),
    [session],
  )

  const canAny = useCallback(
    (...permissions) => permissions.some((permission) => session?.permissions?.includes(permission)),
    [session],
  )

  const value = useMemo(
    () => ({
      session,
      loading,
      appearance,
      theme,
      setTheme,
      signIn,
      signOut,
      switchLocation,
      switchCompany,
      refresh: loadSession,
      can,
      canAny,
    }),
    [session, loading, appearance, theme, signIn, signOut, switchLocation, switchCompany, loadSession, can, canAny],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
