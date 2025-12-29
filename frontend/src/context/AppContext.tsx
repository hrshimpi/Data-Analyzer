import React, { createContext, useContext, useReducer, useEffect } from 'react'
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

  // Load state from localStorage on mount
  useEffect(() => {
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

