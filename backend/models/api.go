package models

// UploadResponse represents the response from /upload endpoint
type UploadResponse struct {
	FileID   string                  `json:"fileId"`
	FileName string                  `json:"fileName,omitempty"`
	Columns  []ColumnInfo            `json:"columns"`
	Summary  map[string]SummaryStats `json:"summary"`
}

// ColumnInfo represents column metadata
type ColumnInfo struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

// SummaryStats represents statistical summary for a column
type SummaryStats struct {
	Min         *float64 `json:"min,omitempty"`
	Max         *float64 `json:"max,omitempty"`
	Mean        *float64 `json:"mean,omitempty"`
	Median      *float64 `json:"median,omitempty"`
	StdDev      *float64 `json:"stdDev,omitempty"`
	UniqueCount *int     `json:"uniqueCount,omitempty"`
	NullCount   int      `json:"nullCount"`
	TotalCount  int      `json:"totalCount"`
}

// SuggestionsRequest represents request for /suggestions
type SuggestionsRequest struct {
	FileID  string                  `json:"fileId"`
	Columns []ColumnInfo            `json:"columns"`
	Summary map[string]SummaryStats `json:"summary"`
}

// SuggestionsResponse represents response from /suggestions
type SuggestionsResponse struct {
	Suggestions []string `json:"suggestions"`
}

// AnalyzeRequest represents request for /analyze
type AnalyzeRequest struct {
	FileID string `json:"fileId"`
	Prompt string `json:"prompt"`
}

// AnalyzeResponse represents response from /analyze
type AnalyzeResponse struct {
	Insights      string        `json:"insights"`
	Charts        []ChartConfig `json:"charts"`
	ChartStatus   string        `json:"chartStatus,omitempty"`   // "success", "partial", "failed", "not_feasible"
	ChartMessage  string        `json:"chartMessage,omitempty"`  // Message explaining chart generation status
	RetryAttempts int           `json:"retryAttempts,omitempty"` // Number of retry attempts made
}

// ChartConfig represents chart configuration
type ChartConfig struct {
	Type      string                   `json:"type"` // bar, line, scatter, pie, area, combo, histogram, boxplot, bubble, correlation
	Title     string                   `json:"title,omitempty"`
	X         string                   `json:"x,omitempty"`
	Y         string                   `json:"y,omitempty"`
	Y2        string                   `json:"y2,omitempty"` // For combo charts
	Z         string                   `json:"z,omitempty"`  // For bubble charts (size)
	Data      []map[string]interface{} `json:"data,omitempty"`
	Category  string                   `json:"category,omitempty"`
	Value     string                   `json:"value,omitempty"`
	GroupBy   string                   `json:"groupBy,omitempty"`   // For grouped/stacked charts
	Stacked   bool                     `json:"stacked,omitempty"`   // For stacked bar charts
	Aggregate string                   `json:"aggregate,omitempty"` // sum, avg, count, max, min
	Bins      int                      `json:"bins,omitempty"`      // For histograms
	Columns   []string                 `json:"columns,omitempty"`   // For correlation/heatmap
}

// ContextualSuggestionsRequest represents request for /contextual-suggestions
type ContextualSuggestionsRequest struct {
	FileID      string        `json:"fileId"`
	RecentChats []ChatMessage `json:"recentChats"`
}

// ChatMessage represents a chat message
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ErrorResponse represents error response
type ErrorResponse struct {
	Error     string `json:"error"`
	RequestID string `json:"requestId,omitempty"`
	Status    int    `json:"status,omitempty"`
	Type      string `json:"type,omitempty"`
}
