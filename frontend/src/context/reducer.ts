import type { AppState, ChatMessage, ChartConfig, DatasetSchema, PinnedChart, DashboardLayout, ThreadSummary } from '../types'

export type AppAction =
  | { type: 'SET_SUGGESTIONS'; payload: string[] }
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'RESET_APP' }
  | { type: 'SET_THREADS'; payload: ThreadSummary[] }
  | { type: 'UPSERT_THREAD'; payload: ThreadSummary }
  | { type: 'REMOVE_THREAD'; payload: string }
  | {
      type: 'SET_ACTIVE_THREAD_DATA'
      payload: { threadId: string; schema: DatasetSchema; messages: ChatMessage[] }
    }
  | { type: 'CLEAR_ACTIVE_THREAD' }
  | { type: 'PIN_CHART'; payload: { threadId: string; chart: ChartConfig; sourcePrompt?: string } }
  | { type: 'UNPIN_CHART'; payload: { threadId: string; chartId: string } }
  | { type: 'UPDATE_DASHBOARD_LAYOUT'; payload: { threadId: string; layouts: Array<{ id: string } & DashboardLayout> } }
  | { type: 'LOAD_PINNED_CHARTS'; payload: Record<string, PinnedChart[]> }

export const initialState: AppState = {
  fileId: null,
  schema: null,
  suggestions: [],
  chats: [],
  threads: [],
  activeThreadId: null,
  pinnedChartsByThread: {},
}

function sortByUpdatedDesc(threads: ThreadSummary[]): ThreadSummary[] {
  return [...threads].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SUGGESTIONS':
      return {
        ...state,
        suggestions: action.payload,
      }

    case 'ADD_MESSAGE':
      return {
        ...state,
        chats: [...state.chats, action.payload],
      }

    case 'SET_THREADS':
      return {
        ...state,
        threads: sortByUpdatedDesc(action.payload),
      }

    case 'UPSERT_THREAD': {
      const others = state.threads.filter((t) => t.id !== action.payload.id)
      return {
        ...state,
        threads: sortByUpdatedDesc([...others, action.payload]),
      }
    }

    case 'REMOVE_THREAD': {
      const threads = state.threads.filter((t) => t.id !== action.payload)
      const { [action.payload]: _removed, ...restPinned } = state.pinnedChartsByThread
      const wasActive = state.activeThreadId === action.payload
      return {
        ...state,
        threads,
        pinnedChartsByThread: restPinned,
        ...(wasActive
          ? { activeThreadId: null, fileId: null, schema: null, chats: [], suggestions: [] }
          : {}),
      }
    }

    case 'SET_ACTIVE_THREAD_DATA':
      return {
        ...state,
        activeThreadId: action.payload.threadId,
        fileId: action.payload.schema.fileId,
        schema: action.payload.schema,
        chats: action.payload.messages,
        suggestions: [],
      }

    case 'CLEAR_ACTIVE_THREAD':
      return {
        ...state,
        activeThreadId: null,
        fileId: null,
        schema: null,
        chats: [],
        suggestions: [],
      }

    case 'PIN_CHART': {
      const { threadId, chart, sourcePrompt } = action.payload
      const existingCount = state.pinnedChartsByThread[threadId]?.length ?? 0
      const newPin: PinnedChart = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        chart,
        sourcePrompt,
        pinnedAt: Date.now(),
        // Alternate left/right so pins tile two-per-row by default; y:
        // Infinity tells react-grid-layout to place it below existing tiles
        // in that column instead of overlapping them.
        layout: { x: existingCount % 2 === 0 ? 0 : 6, y: Infinity, w: 6, h: 8 },
      }
      return {
        ...state,
        pinnedChartsByThread: {
          ...state.pinnedChartsByThread,
          [threadId]: [...(state.pinnedChartsByThread[threadId] ?? []), newPin],
        },
      }
    }

    case 'UNPIN_CHART': {
      const { threadId, chartId } = action.payload
      return {
        ...state,
        pinnedChartsByThread: {
          ...state.pinnedChartsByThread,
          [threadId]: (state.pinnedChartsByThread[threadId] ?? []).filter((p) => p.id !== chartId),
        },
      }
    }

    case 'UPDATE_DASHBOARD_LAYOUT': {
      const { threadId, layouts } = action.payload
      const layoutById = new Map(layouts.map((l) => [l.id, l]))
      return {
        ...state,
        pinnedChartsByThread: {
          ...state.pinnedChartsByThread,
          [threadId]: (state.pinnedChartsByThread[threadId] ?? []).map((p) => {
            const updated = layoutById.get(p.id)
            return updated ? { ...p, layout: { x: updated.x, y: updated.y, w: updated.w, h: updated.h } } : p
          }),
        },
      }
    }

    case 'LOAD_PINNED_CHARTS':
      return { ...state, pinnedChartsByThread: action.payload }

    case 'RESET_APP':
      return initialState

    default:
      return state
  }
}
