import type { PinnedChart } from '../types'

// Chat threads and messages are persisted server-side now (see
// api/backend.ts's thread endpoints) — this file no longer touches them.
//
// Pinned dashboard charts have no backend support yet, so they're still
// kept here, in their own narrowly-scoped key, isolated from anything
// thread/message-related.
const PINNED_CHARTS_KEY = 'orion_pinned_charts'

export const savePinnedCharts = (data: Record<string, PinnedChart[]>): void => {
  try {
    localStorage.setItem(PINNED_CHARTS_KEY, JSON.stringify(data))
  } catch (error) {
    console.error('Failed to save pinned charts to localStorage:', error)
  }
}

export const loadPinnedCharts = (): Record<string, PinnedChart[]> => {
  try {
    const serialized = localStorage.getItem(PINNED_CHARTS_KEY)
    return serialized ? JSON.parse(serialized) : {}
  } catch (error) {
    console.error('Failed to load pinned charts from localStorage:', error)
    return {}
  }
}
