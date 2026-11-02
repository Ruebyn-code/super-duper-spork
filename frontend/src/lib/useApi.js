import { useCallback, useEffect, useRef, useState } from 'react'

// Small data hook: fetch on mount / when `key` changes, expose reload.
export function useApi(loader, key = '', { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: enabled })
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  const load = useCallback(
    async (signal) => {
      setState((current) => ({ ...current, loading: true, error: null }))
      try {
        const data = await loaderRef.current()
        if (signal?.aborted) return
        setState({ data, error: null, loading: false })
      } catch (error) {
        if (signal?.aborted) return
        setState({ data: null, error, loading: false })
      }
    },
    [],
  )

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, error: null, loading: false })
      return undefined
    }
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  return { ...state, reload: () => load() }
}
