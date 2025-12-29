import type { AppState, DatasetSchema, ChatMessage, ChartConfig, ChatThread } from '../types'

export type AppAction =
  | { type: 'SET_SCHEMA'; payload: DatasetSchema }
  | { type: 'SET_SUGGESTIONS'; payload: string[] }
  | { type: 'ADD_CHAT'; payload: ChatMessage }
  | { type: 'SET_CHARTS'; payload: ChartConfig[] }
  | { type: 'RESET_APP' }
  | { type: 'LOAD_STATE'; payload: AppState }
  | { type: 'CREATE_CHAT_THREAD'; payload: ChatThread }
  | { type: 'SET_ACTIVE_THREAD'; payload: string }
  | { type: 'UPDATE_THREAD'; payload: { threadId: string; message: ChatMessage } }
  | { type: 'UPDATE_THREAD_FILE'; payload: { threadId: string; fileId: string; schema: DatasetSchema; title?: string } }
  | { type: 'UPDATE_THREAD_TITLE'; payload: { threadId: string; title: string } }
  | { type: 'DELETE_THREAD'; payload: string }

export const initialState: AppState = {
  fileId: null,
  schema: null,
  suggestions: [],
  chats: [],
  charts: [],
  chatThreads: [],
  activeThreadId: null,
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SCHEMA':
      // Update the active thread with fileId and schema
      const updatedThreadsWithSchema = state.chatThreads.map(thread => {
        if (thread.id === state.activeThreadId) {
          return {
            ...thread,
            fileId: action.payload.fileId,
            schema: action.payload,
          }
        }
        return thread
      })
      return {
        ...state,
        fileId: action.payload.fileId,
        schema: action.payload,
        chatThreads: updatedThreadsWithSchema,
      }

    case 'SET_SUGGESTIONS':
      return {
        ...state,
        suggestions: action.payload,
      }

    case 'ADD_CHAT':
      return {
        ...state,
        chats: [...state.chats, action.payload],
      }

    case 'SET_CHARTS':
      return {
        ...state,
        charts: action.payload,
      }

    case 'CREATE_CHAT_THREAD':
      return {
        ...state,
        chatThreads: [...state.chatThreads, action.payload],
        activeThreadId: action.payload.id,
        chats: action.payload.messages,
        fileId: action.payload.fileId || null,
        schema: action.payload.schema || null,
      }

    case 'SET_ACTIVE_THREAD':
      const activeThread = state.chatThreads.find(t => t.id === action.payload)
      return {
        ...state,
        activeThreadId: action.payload,
        chats: activeThread?.messages || [],
        fileId: activeThread?.fileId || null,
        schema: activeThread?.schema || null,
      }

    case 'UPDATE_THREAD':
      const updatedThreads = state.chatThreads.map(thread => {
        if (thread.id === action.payload.threadId) {
          return {
            ...thread,
            messages: [...thread.messages, action.payload.message],
            updatedAt: Date.now(),
            title: thread.messages.length === 0 
              ? action.payload.message.content.substring(0, 50) 
              : thread.title,
          }
        }
        return thread
      })
      return {
        ...state,
        chatThreads: updatedThreads,
        chats: state.activeThreadId === action.payload.threadId
          ? [...state.chats, action.payload.message]
          : state.chats,
      }

    case 'UPDATE_THREAD_FILE':
      const threadsWithFile = state.chatThreads.map(thread => {
        if (thread.id === action.payload.threadId) {
          return {
            ...thread,
            fileId: action.payload.fileId,
            schema: action.payload.schema,
            title: action.payload.title || thread.title,
            updatedAt: Date.now(),
          }
        }
        return thread
      })
      // If this is the active thread, update the global state too
      if (state.activeThreadId === action.payload.threadId) {
        return {
          ...state,
          chatThreads: threadsWithFile,
          fileId: action.payload.fileId,
          schema: action.payload.schema,
        }
      }
      return {
        ...state,
        chatThreads: threadsWithFile,
      }

    case 'UPDATE_THREAD_TITLE':
      const threadsWithTitle = state.chatThreads.map(thread => {
        if (thread.id === action.payload.threadId) {
          return {
            ...thread,
            title: action.payload.title,
            updatedAt: Date.now(),
          }
        }
        return thread
      })
      return {
        ...state,
        chatThreads: threadsWithTitle,
      }

    case 'DELETE_THREAD':
      const filteredThreads = state.chatThreads.filter(t => t.id !== action.payload)
      const newActiveId = filteredThreads.length > 0 
        ? (state.activeThreadId === action.payload ? filteredThreads[0].id : state.activeThreadId)
        : null
      const newActiveThread = filteredThreads.find(t => t.id === newActiveId)
      return {
        ...state,
        chatThreads: filteredThreads,
        activeThreadId: newActiveId,
        chats: newActiveThread?.messages || [],
        fileId: newActiveThread?.fileId || null,
        schema: newActiveThread?.schema || null,
      }

    case 'RESET_APP':
      return initialState

    case 'LOAD_STATE':
      return action.payload

    default:
      return state
  }
}

