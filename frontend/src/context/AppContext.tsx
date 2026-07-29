import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react'
import { appReducer, initialState, type AppAction } from './reducer'
import type { AppState } from '../types'
import { loadPinnedCharts, savePinnedCharts } from '../utils/localStorage'
import { getThreadMessages, listThreads } from '../api/backend'

interface AppContextType {
  state: AppState
  dispatch: React.Dispatch<AppAction>
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const hasLoadedRef = useRef(false)

  // Load the thread list (and the most recently active thread's messages)
  // from the backend on mount, instead of reading a localStorage blob.
  // Guarded against React 18 StrictMode's double-invocation of effects in
  // dev, which would otherwise fire this fetch twice on every mount.
  useEffect(() => {
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true

    dispatch({ type: 'LOAD_PINNED_CHARTS', payload: loadPinnedCharts() })

    ;(async () => {
      try {
        const threads = await listThreads()
        dispatch({ type: 'SET_THREADS', payload: threads })
        if (threads.length > 0) {
          const mostRecent = [...threads].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )[0]
          const detail = await getThreadMessages(mostRecent.id)
          dispatch({
            type: 'SET_ACTIVE_THREAD_DATA',
            payload: { threadId: detail.threadId, schema: detail.schema, messages: detail.messages },
          })
        }
      } catch (err) {
        // Not fatal — worst case, the app just shows the upload screen as
        // if there were no prior threads (e.g. the backend isn't reachable
        // yet, or the token is invalid).
        console.error('Failed to load threads on startup:', err)
      }
    })()
  }, [])

  // Pinned dashboard charts are the one remaining piece of localStorage
  // persistence — everything else now lives on the backend.
  useEffect(() => {
    savePinnedCharts(state.pinnedChartsByThread)
  }, [state.pinnedChartsByThread])

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
