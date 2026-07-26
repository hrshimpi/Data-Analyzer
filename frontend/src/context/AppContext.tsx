import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react'
import { appReducer, initialState, type AppAction } from './reducer'
import type { AppState } from '../types'
import { saveState, loadState, cleanupExpiredChats } from '../utils/localStorage'

interface AppContextType {
  state: AppState
  dispatch: React.Dispatch<AppAction>
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const hasLoadedRef = useRef(false)

  // Load state from localStorage on mount. Guarded against React 18
  // StrictMode's double-invocation of effects in dev: without the guard,
  // the second invocation can read localStorage back before the first
  // invocation's LOAD_STATE dispatch has been reflected in a save, getting
  // a stale/default snapshot and clobbering the real one.
  useEffect(() => {
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true
    cleanupExpiredChats()
    const savedState = loadState()
    if (savedState) {
      dispatch({ type: 'LOAD_STATE', payload: savedState })
    }
  }, [])

  // Save state to localStorage whenever it changes
  useEffect(() => {
    saveState(state)
  }, [state])

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppState() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppProvider')
  }
  return context
}

