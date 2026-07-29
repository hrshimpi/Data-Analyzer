export interface ColumnInfo {
  name: string
  type: string
}

export interface SummaryStats {
  min?: number
  max?: number
  mean?: number
  median?: number
  stdDev?: number
  uniqueCount?: number
  nullCount: number
  totalCount: number
}

export interface DatasetSchema {
  fileId: string
  fileName?: string
  columns: ColumnInfo[]
  summary: Record<string, SummaryStats>
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'scatter' | 'pie' | 'area' | 'combo' | 'histogram' | 'boxplot' | 'bubble' | 'correlation'
  title?: string
  x?: string
  y?: string
  y2?: string
  z?: string
  category?: string
  value?: string
  groupBy?: string
  stacked?: boolean
  aggregate?: string
  bins?: number
  columns?: string[]
  data?: Record<string, any>[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  charts?: ChartConfig[]
  chartStatus?: 'success' | 'partial' | 'failed' | 'not_feasible'
  chartMessage?: string
  retryAttempts?: number
  timestamp: number
}

export interface DashboardLayout {
  x: number
  y: number
  w: number
  h: number
}

export interface PinnedChart {
  id: string
  chart: ChartConfig
  sourcePrompt?: string
  pinnedAt: number
  layout: DashboardLayout
}

/** Lightweight thread list entry — from GET /threads. No message data;
 * fetch that separately (GET /threads/{id}/messages) only for the thread
 * currently being viewed. */
export interface ThreadSummary {
  id: string
  title: string
  datasetId: string
  updatedAt: string
}

/** Everything needed to open a thread in one call: its dataset's schema
 * plus its full message history. Returned by both GET /threads/{id}/messages
 * and POST /threads (a freshly created thread is just one with zero
 * messages). */
export interface ThreadDetail {
  threadId: string
  title: string
  schema: DatasetSchema
  messages: ChatMessage[]
}

export interface AppState {
  fileId: string | null
  schema: DatasetSchema | null
  suggestions: string[]
  chats: ChatMessage[]
  threads: ThreadSummary[]
  activeThreadId: string | null
  // Pinned dashboard charts have no backend support yet (out of scope for
  // thread/message persistence) — kept in a small, separately-persisted
  // local store, keyed by thread id, isolated from the API-backed state.
  pinnedChartsByThread: Record<string, PinnedChart[]>
}

export interface SuggestionsResponse {
  suggestions: string[]
}

export interface AnalyzeResponse {
  insights: string
  charts: ChartConfig[]
  chartStatus?: 'success' | 'partial' | 'failed' | 'not_feasible'
  chartMessage?: string
  retryAttempts?: number
  threadId: string
  title: string
}
