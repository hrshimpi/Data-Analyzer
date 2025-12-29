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

export interface ChatThread {
  id: string
  title: string
  messages: ChatMessage[]
  fileId?: string | null
  schema?: DatasetSchema | null
  createdAt: number
  updatedAt: number
}

export interface AppState {
  fileId: string | null
  schema: DatasetSchema | null
  suggestions: string[]
  chats: ChatMessage[]
  charts: ChartConfig[]
  chatThreads: ChatThread[]
  activeThreadId: string | null
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
}

