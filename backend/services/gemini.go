package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/yourname/go-fiber-backend/backend/models"
	"golang.org/x/oauth2/google"
)

// GeminiService handles Gemini API interactions via Vertex AI REST API
type GeminiService struct {
	httpClient *http.Client
	projectID  string
	location   string
	model      string
	baseURL    string
}

// NewGeminiService creates a new Gemini service
func NewGeminiService() (*GeminiService, error) {
	projectID := os.Getenv("GOOGLE_CLOUD_PROJECT_ID")
	location := os.Getenv("GOOGLE_CLOUD_LOCATION")
	if location == "" {
		location = "us-central1"
	}

	if projectID == "" {
		return nil, fmt.Errorf("GOOGLE_CLOUD_PROJECT_ID environment variable is required")
	}

	baseURL := fmt.Sprintf(
		"https://aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models",
		projectID,
		location,
	)

	return &GeminiService{
		httpClient: &http.Client{},
		projectID:  projectID,
		location:   location,
		model:      "gemini-2.5-flash-preview-09-2025",
		baseURL:    baseURL,
	}, nil
}

// GetSuggestions generates analysis suggestions
func (gs *GeminiService) GetSuggestions(columns []models.ColumnInfo, summary map[string]models.SummaryStats) ([]string, error) {
	// Build prompt
	var columnDesc strings.Builder
	columnDesc.WriteString("Dataset columns:\n")
	for _, col := range columns {
		stats, hasStats := summary[col.Name]
		columnDesc.WriteString(fmt.Sprintf("- %s (%s)", col.Name, col.Type))
		if hasStats {
			if stats.Mean != nil {
				columnDesc.WriteString(fmt.Sprintf(" - numeric: min=%.2f, max=%.2f, mean=%.2f", *stats.Min, *stats.Max, *stats.Mean))
			} else if stats.UniqueCount != nil {
				columnDesc.WriteString(fmt.Sprintf(" - categorical: %d unique values", *stats.UniqueCount))
			}
		}
		columnDesc.WriteString("\n")
	}

	prompt := fmt.Sprintf(`You are a data analysis assistant. Given the following dataset schema:

%s

Generate 5-6 specific, actionable business analysis suggestions. Each suggestion should be:
1. Clear and specific
2. Actionable (can be executed)
3. Business-relevant

Return ONLY a JSON array of strings, no other text. Example format:
["Compare average values across categories", "Identify outliers in numeric columns", "Show distribution of categorical data"]

Suggestions:`, columnDesc.String())

	text, err := gs.callGemini(prompt, 0.7)
	if err != nil {
		return nil, err
	}

	text = strings.TrimSpace(text)
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	text = strings.TrimSpace(text)

	var suggestions []string
	if err := json.Unmarshal([]byte(text), &suggestions); err != nil {
		// Fallback: try to parse as plain text lines
		lines := strings.Split(text, "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line != "" && (strings.HasPrefix(line, "\"") || strings.HasPrefix(line, "-") || strings.HasPrefix(line, "*")) {
				line = strings.Trim(line, "\"`-* ")
				if line != "" {
					suggestions = append(suggestions, line)
				}
			}
		}
		if len(suggestions) == 0 {
			return nil, fmt.Errorf("failed to parse suggestions: %w", err)
		}
	}

	if len(suggestions) > 6 {
		suggestions = suggestions[:6]
	}

	return suggestions, nil
}

// GetContextualSuggestions generates suggestions based on recent chat history
func (gs *GeminiService) GetContextualSuggestions(recentChats []models.ChatMessage) ([]string, error) {
	// Build chat history context
	var chatContext strings.Builder
	chatContext.WriteString("Recent conversation:\n")
	for _, msg := range recentChats {
		chatContext.WriteString(fmt.Sprintf("%s: %s\n", msg.Role, msg.Content))
	}

	prompt := fmt.Sprintf(`You are a data analysis assistant. Based on the recent conversation, generate 4-6 specific follow-up questions that would help the user explore their data further.

%s

Generate contextual, relevant follow-up questions that:
1. Build on the previous conversation
2. Explore related aspects of the data
3. Are specific and actionable
4. Help discover new insights

Return ONLY a JSON array of strings, no other text. Example format:
["What is the correlation between X and Y?", "Show the distribution of Z", "Compare A across different categories"]

Suggestions:`, chatContext.String())

	text, err := gs.callGemini(prompt, 0.7)
	if err != nil {
		return nil, err
	}

	text = strings.TrimSpace(text)
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	text = strings.TrimSpace(text)

	var suggestions []string
	if err := json.Unmarshal([]byte(text), &suggestions); err != nil {
		// Fallback: try to parse as plain text lines
		lines := strings.Split(text, "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line != "" && (strings.HasPrefix(line, "\"") || strings.HasPrefix(line, "-") || strings.HasPrefix(line, "*")) {
				line = strings.Trim(line, "\"`-* ")
				if line != "" {
					suggestions = append(suggestions, line)
				}
			}
		}
		if len(suggestions) == 0 {
			return nil, fmt.Errorf("failed to parse contextual suggestions: %w", err)
		}
	}

	if len(suggestions) > 6 {
		suggestions = suggestions[:6]
	}

	return suggestions, nil
}

// Analyze generates pure reasoning insights (Step 1 - no charts)
func (gs *GeminiService) Analyze(dataset *models.Dataset, prompt string) (string, error) {
	// Build dataset schema description
	var schemaDesc strings.Builder
	schemaDesc.WriteString("Dataset Schema:\n")
	for _, col := range dataset.Columns {
		stats := dataset.Summary[col.Name]
		schemaDesc.WriteString(fmt.Sprintf("- %s (%s)", col.Name, col.Type))
		if stats.Mean != nil {
			schemaDesc.WriteString(fmt.Sprintf(" - numeric: min=%.2f, max=%.2f, mean=%.2f", *stats.Min, *stats.Max, *stats.Mean))
		} else if stats.UniqueCount != nil {
			schemaDesc.WriteString(fmt.Sprintf(" - categorical: %d unique values", *stats.UniqueCount))
		}
		schemaDesc.WriteString("\n")
	}

	analysisPrompt := fmt.Sprintf(`You are an expert data analyst. Analyze the dataset and user question to provide clear, actionable insights.

Dataset Schema:
%s

User Question: %s

Your task:
1. Analyze what the user wants to understand from the data
2. Identify key patterns, trends, and observations
3. Provide clear, concise insights (2-4 sentences)
4. Focus on what the data reveals, not on visualization

Return ONLY a plain text insight (no JSON, no markdown, no code blocks). Just the insight text.`, schemaDesc.String(), prompt)

	insights, err := gs.callGemini(analysisPrompt, 0.3)
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(insights), nil
}

// GenerateCharts generates chart configurations (Step 2 - strict JSON only)
func (gs *GeminiService) GenerateCharts(dataset *models.Dataset, prompt string, previousError string) ([]models.ChartConfig, error) {
	// Build dataset schema description
	var schemaDesc strings.Builder
	schemaDesc.WriteString("Dataset Schema:\n")
	for _, col := range dataset.Columns {
		stats := dataset.Summary[col.Name]
		schemaDesc.WriteString(fmt.Sprintf("- %s (%s)", col.Name, col.Type))
		if stats.Mean != nil {
			schemaDesc.WriteString(fmt.Sprintf(" - numeric: min=%.2f, max=%.2f, mean=%.2f", *stats.Min, *stats.Max, *stats.Mean))
		} else if stats.UniqueCount != nil {
			schemaDesc.WriteString(fmt.Sprintf(" - categorical: %d unique values", *stats.UniqueCount))
		}
		schemaDesc.WriteString("\n")
	}

	var chartPrompt string
	if previousError != "" {
		// Corrective retry prompt
		chartPrompt = fmt.Sprintf(`CRITICAL: Previous response did NOT include valid graph JSON or was invalid.
Error: %s

You MUST return ONLY valid JSON. Do NOT include explanations, markdown, or code blocks.

Dataset Schema:
%s

User Question: %s

Generate chart configurations. Return ONLY valid JSON (no markdown, no code blocks):
{
  "charts": [
    {
      "type": "bar|line|scatter|pie|area|combo|histogram|boxplot|bubble|correlation",
      "title": "Descriptive chart title",
      "x": "column_name_for_x_axis",
      "y": "column_name_for_y_axis",
      "y2": "column_name_for_secondary_y_axis (for combo only)",
      "z": "column_name_for_size (for bubble only)",
      "category": "column_name_for_grouping (for pie)",
      "value": "column_name_for_values (for pie)",
      "groupBy": "column_name_for_grouping (for grouped/stacked bars)",
      "stacked": true/false,
      "aggregate": "sum|avg|count|max|min",
      "bins": 20,
      "columns": ["col1", "col2", "col3"]
    }
  ]
}

Column names MUST match exactly from the schema.`, previousError, schemaDesc.String(), prompt)
	} else {
		// Initial chart generation prompt
		chartPrompt = fmt.Sprintf(`You are a chart configuration generator. Generate chart configurations based on the dataset and user question.

Dataset Schema:
%s

User Question: %s

Available Chart Types:
- "bar": Categorical vs numeric
- "line": Values over time
- "scatter": Relationship between two numeric variables
- "pie": Percentage contribution (limited categories)
- "area": Cumulative trends
- "combo": Bar + line combination
- "histogram": Distribution of numeric column (use x, set bins: 20)
- "boxplot": Spread, median, quartiles (use y)
- "bubble": Relationship + third variable as size (use x, y, z)
- "correlation": Correlation matrix (use columns array)

Return ONLY valid JSON (no markdown, no code blocks):
{
  "charts": [
    {
      "type": "bar|line|scatter|pie|area|combo|histogram|boxplot|bubble|correlation",
      "title": "Descriptive chart title",
      "x": "column_name_for_x_axis",
      "y": "column_name_for_y_axis",
      "y2": "column_name_for_secondary_y_axis (for combo only)",
      "z": "column_name_for_size (for bubble only)",
      "category": "column_name_for_grouping (for pie)",
      "value": "column_name_for_values (for pie)",
      "groupBy": "column_name_for_grouping (for grouped/stacked bars)",
      "stacked": true/false,
      "aggregate": "sum|avg|count|max|min",
      "bins": 20,
      "columns": ["col1", "col2", "col3"]
    }
  ]
}

Critical Rules:
- Column names MUST match exactly from the schema
- Return ONLY JSON, no explanations
- For histograms: use "x" with numeric column, set "bins" (default 20)
- For boxplots: use "y" with numeric column
- For correlation: use "columns" array with numeric column names
- For bubble: use "x", "y", and "z" (z is size)`, schemaDesc.String(), prompt)
	}

	text, err := gs.callGemini(chartPrompt, 0.1) // Lower temperature for more consistent JSON
	if err != nil {
		return nil, err
	}

	// Extract JSON from response (handle markdown code blocks, plain JSON, etc.)
	jsonText := gs.extractJSON(text)
	if jsonText == "" {
		return nil, fmt.Errorf("no JSON found in response")
	}

	var result struct {
		Charts []models.ChartConfig `json:"charts"`
	}

	if err := json.Unmarshal([]byte(jsonText), &result); err != nil {
		return nil, fmt.Errorf("invalid JSON response: %w. Extracted text: %s", err, jsonText[:min(200, len(jsonText))])
	}

	if len(result.Charts) == 0 {
		return nil, fmt.Errorf("no charts in JSON response")
	}

	return result.Charts, nil
}

// callGemini calls Vertex AI Gemini API via REST
func (gs *GeminiService) callGemini(prompt string, temperature float64) (string, error) {
	ctx := context.Background()

	// Get authentication token with proper error handling
	creds, err := google.FindDefaultCredentials(ctx, "https://www.googleapis.com/auth/cloud-platform")
	if err != nil {
		return "", fmt.Errorf("authentication failed: %w. Please ensure you have run 'gcloud auth application-default login' or set GOOGLE_APPLICATION_CREDENTIALS environment variable", err)
	}

	token, err := creds.TokenSource.Token()
	if err != nil {
		return "", fmt.Errorf("failed to obtain access token: %w. Please check your Google Cloud credentials", err)
	}

	url := fmt.Sprintf("%s/%s:generateContent", gs.baseURL, gs.model)

	requestBody := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"role": "user",
				"parts": []map[string]interface{}{
					{
						"text": prompt,
					},
				},
			},
		},
		"generationConfig": map[string]interface{}{
			"temperature":     temperature,
			"maxOutputTokens": 2048,
		},
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token.AccessToken))

	resp, err := gs.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("network error calling Gemini API: %w. Please check your internet connection and try again", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response from Gemini API: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		// Parse error response if possible
		var errorMsg string
		if len(body) > 0 {
			errorMsg = string(body)
		} else {
			errorMsg = "Unknown error"
		}
		
		if resp.StatusCode == 401 || resp.StatusCode == 403 {
			return "", fmt.Errorf("authentication error (status %d): %s. Please check your Google Cloud credentials and permissions", resp.StatusCode, errorMsg)
		} else if resp.StatusCode == 429 {
			return "", fmt.Errorf("rate limit exceeded (status %d): %s. Please wait a moment and try again", resp.StatusCode, errorMsg)
		} else if resp.StatusCode >= 500 {
			return "", fmt.Errorf("Gemini API server error (status %d): %s. Please try again later", resp.StatusCode, errorMsg)
		}
		return "", fmt.Errorf("Gemini API error (status %d): %s", resp.StatusCode, errorMsg)
	}

	var response struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	if err := json.Unmarshal(body, &response); err != nil {
		return "", fmt.Errorf("failed to parse Gemini API response: %w. Response may be malformed", err)
	}

	if len(response.Candidates) == 0 {
		return "", fmt.Errorf("no candidates in Gemini API response. The API may have filtered the content")
	}

	if len(response.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty content in Gemini API response. The model may have generated no output")
	}

	return response.Candidates[0].Content.Parts[0].Text, nil
}

// extractJSON extracts JSON from text, handling markdown code blocks and plain JSON
func (gs *GeminiService) extractJSON(text string) string {
	text = strings.TrimSpace(text)

	// Remove markdown code blocks
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	text = strings.TrimSpace(text)

	// Try to find JSON object boundaries
	startIdx := strings.Index(text, "{")
	if startIdx == -1 {
		return text // Return as-is if no opening brace
	}

	// Find matching closing brace
	braceCount := 0
	endIdx := -1
	for i := startIdx; i < len(text); i++ {
		if text[i] == '{' {
			braceCount++
		} else if text[i] == '}' {
			braceCount--
			if braceCount == 0 {
				endIdx = i + 1
				break
			}
		}
	}

	if endIdx > startIdx {
		return text[startIdx:endIdx]
	}

	return text[startIdx:]
}

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Close closes the Gemini service (no-op for HTTP client)
func (gs *GeminiService) Close() error {
	return nil
}
