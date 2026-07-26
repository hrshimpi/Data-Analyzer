import type { AppState, ChatThread } from '../types'

const STORAGE_KEY = 'orion_data_analyzer_state'
const CHAT_STORAGE_KEY = 'orion_chat_threads'
const CHAT_EXPIRY_KEY = 'orion_chat_expiry'
const CHAT_EXPIRY_HOURS = 24 // Chat data expires after 24 hours

export const saveState = (state: AppState): void => {
  try {
    // Persisted as-is, including fileId/schema, so a page reload resumes the
    // active session. If the backend has since restarted (in-memory storage
    // cleared), the next request against a stale fileId surfaces a clear
    // "dataset not found, please re-upload" error rather than silently
    // losing the whole session on every refresh.
    const serialized = JSON.stringify(state)
    localStorage.setItem(STORAGE_KEY, serialized)
    
    // Save chat threads separately with expiry
    if (state.chatThreads && state.chatThreads.length > 0) {
      const expiryTime = Date.now() + (CHAT_EXPIRY_HOURS * 60 * 60 * 1000)
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(state.chatThreads))
      localStorage.setItem(CHAT_EXPIRY_KEY, expiryTime.toString())
    }
  } catch (error) {
    console.error('Failed to save state to localStorage:', error)
  }
}

export const loadState = (): AppState | null => {
  try {
    // Check if chat data has expired
    const expiryTime = localStorage.getItem(CHAT_EXPIRY_KEY)
    if (expiryTime && Date.now() > parseInt(expiryTime)) {
      // Clear expired chat data
      localStorage.removeItem(CHAT_STORAGE_KEY)
      localStorage.removeItem(CHAT_EXPIRY_KEY)
    }

    const serialized = localStorage.getItem(STORAGE_KEY)
    if (serialized === null) {
      return null
    }
    
    const state = JSON.parse(serialized) as AppState
    
    // Load chat threads if they exist and haven't expired
    const chatThreadsData = localStorage.getItem(CHAT_STORAGE_KEY)
    if (chatThreadsData) {
      const threads = JSON.parse(chatThreadsData) as ChatThread[]
      state.chatThreads = threads
    }
    
    return state
  } catch (error) {
    console.error('Failed to load state from localStorage:', error)
    return null
  }
}

export const clearState = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(CHAT_STORAGE_KEY)
    localStorage.removeItem(CHAT_EXPIRY_KEY)
  } catch (error) {
    console.error('Failed to clear state from localStorage:', error)
  }
}

// Clean up expired chat data on load
export const cleanupExpiredChats = (): void => {
  try {
    const expiryTime = localStorage.getItem(CHAT_EXPIRY_KEY)
    if (expiryTime && Date.now() > parseInt(expiryTime)) {
      localStorage.removeItem(CHAT_STORAGE_KEY)
      localStorage.removeItem(CHAT_EXPIRY_KEY)
    }
  } catch (error) {
    console.error('Failed to cleanup expired chats:', error)
  }
}
