import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useSession } from './SessionContext'

const CartContext = createContext(null)

export function useCart() {
  const value = useContext(CartContext)
  if (!value) throw new Error('useCart must be used inside CartProvider')
  return value
}

function storageKey(session) {
  if (!session) return ''
  return `opstack-cart-${session.id}-${session.locationId || 'none'}`
}

export function CartProvider({ children }) {
  const { session } = useSession()
  const key = storageKey(session)
  const [items, setItems] = useState({})

  useEffect(() => {
    if (!key) {
      setItems({})
      return
    }
    try {
      const raw = localStorage.getItem(key)
      setItems(raw ? JSON.parse(raw) : {})
    } catch {
      setItems({})
    }
  }, [key])

  useEffect(() => {
    if (!key) return
    try {
      localStorage.setItem(key, JSON.stringify(items))
    } catch {
      /* storage unavailable */
    }
  }, [items, key])

  const add = useCallback((productId, quantity = 1) => {
    setItems((current) => ({
      ...current,
      [productId]: (current[productId] || 0) + quantity,
    }))
  }, [])

  const setQuantity = useCallback((productId, quantity) => {
    setItems((current) => {
      const next = { ...current }
      if (!quantity || quantity < 1) delete next[productId]
      else next[productId] = Math.min(999, Math.round(quantity))
      return next
    })
  }, [])

  const remove = useCallback((productId) => {
    setItems((current) => {
      const next = { ...current }
      delete next[productId]
      return next
    })
  }, [])

  const clear = useCallback(() => setItems({}), [])

  const count = useMemo(
    () => Object.values(items).reduce((total, quantity) => total + quantity, 0),
    [items],
  )

  const value = useMemo(
    () => ({ items, add, setQuantity, remove, clear, count }),
    [items, add, setQuantity, remove, clear, count],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
