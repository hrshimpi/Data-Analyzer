package services

import (
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"

	"github.com/yourname/go-fiber-backend/backend/models"
)

// AnalysisEngine processes analysis requests and generates chart data
type AnalysisEngine struct {
	gemini *GeminiService
}

// NewAnalysisEngine creates a new analysis engine
func NewAnalysisEngine(gemini *GeminiService) *AnalysisEngine {
	return &AnalysisEngine{
		gemini: gemini,
	}
}

// ProcessAnalysisResult contains the result of analysis processing
type ProcessAnalysisResult struct {
	Insights      string
	Charts        []models.ChartConfig
	ChartStatus   string // "success", "partial", "failed", "not_feasible"
	ChartMessage  string
	RetryAttempts int
}

// ProcessAnalysis processes analysis request using two-step flow with retry logic
func (ae *AnalysisEngine) ProcessAnalysis(dataset *models.Dataset, prompt string) (*ProcessAnalysisResult, error) {
	// Validate inputs
	if dataset == nil {
		return nil, fmt.Errorf("dataset cannot be nil")
	}
	if len(dataset.Rows) == 0 {
		return nil, fmt.Errorf("dataset is empty")
	}
	if prompt == "" {
		return nil, fmt.Errorf("prompt cannot be empty")
	}

	// Step 1: Pure reasoning (no charts)
	insights, err := ae.gemini.Analyze(dataset, prompt)
	if err != nil {
		return nil, fmt.Errorf("analysis step failed: %w", err)
	}
	
	// Validate insights were generated
	if insights == "" {
		return nil, fmt.Errorf("analysis step returned empty insights")
	}

	// Step 2: Chart generation with retry logic
	result := &ProcessAnalysisResult{
		Insights:      insights,
		Charts:        []models.ChartConfig{},
		ChartStatus:   "failed",
		ChartMessage:  "",
		RetryAttempts: 0,
	}

	// Check feasibility before attempting chart generation
	if !ae.isChartGenerationFeasible(dataset) {
		result.ChartStatus = "not_feasible"
		result.ChartMessage = "Graph cannot be generated due to insufficient or incompatible data. The dataset may be too small, missing required columns, or lack numeric data."
		return result, nil
	}

	// Retry loop (max 3 attempts)
	maxAttempts := 3
	var lastError string

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		result.RetryAttempts = attempt

		chartConfigs, err := ae.gemini.GenerateCharts(dataset, prompt, lastError)
		if err != nil {
			// Check if it's a JSON parsing error
			lastError = err.Error()

			// If it's a JSON error and we have retries left, continue
			if attempt < maxAttempts {
				// Enhance error message for next retry
				if strings.Contains(err.Error(), "JSON") || strings.Contains(err.Error(), "json") {
					lastError = fmt.Sprintf("Previous response did NOT include valid graph JSON. Error: %s. You MUST return ONLY valid JSON in the exact format specified, with no explanations, markdown, or code blocks.", err.Error())
				}
				continue // Retry
			}
			// Final attempt failed
			result.ChartStatus = "failed"
			result.ChartMessage = "Visual representation could not be generated reliably for this prompt or your requirements."
			return result, nil
		}

		// Validate and populate chart data
		validCharts := []models.ChartConfig{}
		for i := range chartConfigs {
			chart := &chartConfigs[i]

			// Validate chart configuration
			if !ae.validateChartConfig(dataset, chart) {
				continue // Skip invalid chart
			}

			// Generate chart data
			chart.Data = ae.generateChartData(dataset, chart)

			// Check if data was generated successfully
			if len(chart.Data) == 0 {
				continue // Skip charts with no data
			}

			validCharts = append(validCharts, *chart)
		}

		if len(validCharts) > 0 {
			result.Charts = validCharts
			if len(validCharts) == len(chartConfigs) {
				result.ChartStatus = "success"
			} else {
				result.ChartStatus = "partial"
				result.ChartMessage = fmt.Sprintf("Generated %d out of %d requested charts", len(validCharts), len(chartConfigs))
			}
			return result, nil
		}

		// No valid charts generated, prepare retry
		if attempt < maxAttempts {
			lastError = "No valid charts were generated. Please ensure column names match the schema exactly and chart types are appropriate for the data."
			continue
		}
	}

	// All attempts failed
	result.ChartStatus = "failed"
	result.ChartMessage = "Visual representation could not be generated reliably for this prompt or your requirements."
	return result, nil
}

// isChartGenerationFeasible checks if chart generation is feasible
func (ae *AnalysisEngine) isChartGenerationFeasible(dataset *models.Dataset) bool {
	// Check dataset size
	if len(dataset.Rows) <= 1 {
		return false
	}

	// At least one column required
	if len(dataset.Columns) == 0 {
		return false
	}

	// For basic charts like pie charts, we can work with categorical data only
	// But for most chart types, we need at least one numeric column
	// We'll allow it if there's at least one column (categorical charts can work)
	return true
}

// validateChartConfig validates a chart configuration against the dataset
func (ae *AnalysisEngine) validateChartConfig(dataset *models.Dataset, chart *models.ChartConfig) bool {
	// Check required columns exist
	columnMap := make(map[string]bool)
	for _, col := range dataset.Columns {
		columnMap[col.Name] = true
	}

	switch chart.Type {
	case "bar", "line", "area", "scatter", "combo":
		if chart.X != "" && !columnMap[chart.X] {
			return false
		}
		if chart.Y != "" && !columnMap[chart.Y] {
			return false
		}
		if chart.Y2 != "" && !columnMap[chart.Y2] {
			return false
		}
		if chart.GroupBy != "" && !columnMap[chart.GroupBy] {
			return false
		}
	case "pie":
		if chart.Category != "" && !columnMap[chart.Category] {
			return false
		}
		if chart.Value != "" && !columnMap[chart.Value] {
			return false
		}
	case "histogram":
		if chart.X != "" && !columnMap[chart.X] {
			return false
		}
	case "boxplot":
		if chart.Y != "" && !columnMap[chart.Y] {
			return false
		}
	case "bubble":
		if chart.X != "" && !columnMap[chart.X] {
			return false
		}
		if chart.Y != "" && !columnMap[chart.Y] {
			return false
		}
		if chart.Z != "" && !columnMap[chart.Z] {
			return false
		}
	case "correlation", "heatmap":
		if len(chart.Columns) == 0 {
			return false
		}
		for _, col := range chart.Columns {
			if !columnMap[col] {
				return false
			}
		}
	default:
		return false // Unknown chart type
	}

	return true
}

// generateChartData generates data points for a chart
func (ae *AnalysisEngine) generateChartData(dataset *models.Dataset, chart *models.ChartConfig) []map[string]interface{} {
	data := make([]map[string]interface{}, 0)

	switch chart.Type {
	case "bar", "line", "area":
		if chart.X != "" && chart.Y != "" {
			if chart.GroupBy != "" {
				// Grouped or stacked bar chart
				data = ae.generateGroupedData(dataset, chart)
			} else if chart.Aggregate != "" {
				// Aggregated data
				data = ae.generateAggregatedData(dataset, chart)
			} else {
				// Simple XY data
				data = ae.generateXYData(dataset, chart.X, chart.Y)
			}
		}
	case "scatter":
		if chart.X != "" && chart.Y != "" {
			data = ae.generateXYData(dataset, chart.X, chart.Y)
		}
	case "bubble":
		if chart.X != "" && chart.Y != "" && chart.Z != "" {
			data = ae.generateBubbleData(dataset, chart)
		}
	case "pie":
		if chart.Category != "" && chart.Value != "" {
			data = ae.generatePieData(dataset, chart.Category, chart.Value)
		}
	case "combo":
		if chart.X != "" && chart.Y != "" {
			data = ae.generateComboData(dataset, chart)
		}
	case "histogram":
		if chart.X != "" {
			data = ae.generateHistogramData(dataset, chart)
		}
	case "boxplot":
		if chart.Y != "" {
			data = ae.generateBoxplotData(dataset, chart)
		}
	case "correlation", "heatmap":
		if len(chart.Columns) > 0 {
			data = ae.generateCorrelationData(dataset, chart)
		}
	}

	return data
}

func (ae *AnalysisEngine) generateXYData(dataset *models.Dataset, xCol, yCol string) []map[string]interface{} {
	xValues := dataset.GetColumnData(xCol)
	yValues := dataset.GetColumnData(yCol)

	if len(xValues) != len(yValues) {
		return []map[string]interface{}{}
	}

	data := make([]map[string]interface{}, 0, len(xValues))
	for i := 0; i < len(xValues) && i < 100; i++ { // Limit to 100 points
		xVal := xValues[i]
		yVal := yValues[i]

		// Try to convert to numbers
		xNum, xErr := ae.toNumber(xVal)
		yNum, yErr := ae.toNumber(yVal)

		point := map[string]interface{}{
			xCol: xVal,
			yCol: yVal,
		}

		if xErr == nil {
			point[xCol] = xNum
		}
		if yErr == nil {
			point[yCol] = yNum
		}

		data = append(data, point)
	}

	return data
}

func (ae *AnalysisEngine) generatePieData(dataset *models.Dataset, categoryCol, valueCol string) []map[string]interface{} {
	categoryValues := dataset.GetColumnData(categoryCol)
	valueValues := dataset.GetColumnData(valueCol)

	if len(categoryValues) != len(valueValues) {
		return []map[string]interface{}{}
	}

	// Aggregate by category
	aggregated := make(map[string]float64)
	for i := 0; i < len(categoryValues); i++ {
		category := fmt.Sprintf("%v", categoryValues[i])
		value, err := ae.toNumber(valueValues[i])
		if err == nil {
			aggregated[category] += value
		}
	}

	data := make([]map[string]interface{}, 0, len(aggregated))
	for category, value := range aggregated {
		data = append(data, map[string]interface{}{
			categoryCol: category,
			valueCol:    value,
		})
	}

	return data
}

// generateGroupedData generates data for grouped/stacked bar charts
func (ae *AnalysisEngine) generateGroupedData(dataset *models.Dataset, chart *models.ChartConfig) []map[string]interface{} {
	xValues := dataset.GetColumnData(chart.X)
	yValues := dataset.GetColumnData(chart.Y)
	groupValues := dataset.GetColumnData(chart.GroupBy)

	if len(xValues) != len(yValues) || len(xValues) != len(groupValues) {
		return []map[string]interface{}{}
	}

	// Group data by X and GroupBy
	grouped := make(map[string]map[string][]float64) // xValue -> groupValue -> []values (for avg calculation)
	groups := make(map[string]bool)

	// First pass: collect all values
	for i := 0; i < len(xValues); i++ {
		xVal := fmt.Sprintf("%v", xValues[i])
		groupVal := fmt.Sprintf("%v", groupValues[i])
		yVal, err := ae.toNumber(yValues[i])
		if err != nil {
			continue
		}

		if grouped[xVal] == nil {
			grouped[xVal] = make(map[string][]float64)
		}

		if grouped[xVal][groupVal] == nil {
			grouped[xVal][groupVal] = make([]float64, 0)
		}

		grouped[xVal][groupVal] = append(grouped[xVal][groupVal], yVal)
		groups[groupVal] = true
	}

	// Second pass: apply aggregation
	data := make([]map[string]interface{}, 0)
	groupList := make([]string, 0, len(groups))
	for g := range groups {
		groupList = append(groupList, g)
	}

	for xVal, groupMap := range grouped {
		point := map[string]interface{}{
			chart.X: xVal,
		}

		for _, groupVal := range groupList {
			values := groupMap[groupVal]
			if len(values) == 0 {
				point[groupVal] = 0
				continue
			}

			var result float64
			switch chart.Aggregate {
			case "sum", "":
				result = 0
				for _, v := range values {
					result += v
				}
			case "avg":
				result = 0
				for _, v := range values {
					result += v
				}
				result = result / float64(len(values))
			case "count":
				result = float64(len(values))
			case "max":
				result = values[0]
				for _, v := range values {
					if v > result {
						result = v
					}
				}
			case "min":
				result = values[0]
				for _, v := range values {
					if v < result {
						result = v
					}
				}
			default:
				result = 0
				for _, v := range values {
					result += v
				}
			}

			point[groupVal] = result
		}

		data = append(data, point)
	}

	return data
}

// generateAggregatedData generates aggregated data (sum, avg, count, etc.)
func (ae *AnalysisEngine) generateAggregatedData(dataset *models.Dataset, chart *models.ChartConfig) []map[string]interface{} {
	xValues := dataset.GetColumnData(chart.X)
	yValues := dataset.GetColumnData(chart.Y)

	if len(xValues) != len(yValues) {
		return []map[string]interface{}{}
	}

	// Aggregate by X
	aggregated := make(map[string][]float64)

	for i := 0; i < len(xValues); i++ {
		xVal := fmt.Sprintf("%v", xValues[i])
		yVal, err := ae.toNumber(yValues[i])
		if err != nil {
			continue
		}

		if aggregated[xVal] == nil {
			aggregated[xVal] = make([]float64, 0)
		}
		aggregated[xVal] = append(aggregated[xVal], yVal)
	}

	// Apply aggregation function
	data := make([]map[string]interface{}, 0, len(aggregated))
	for xVal, values := range aggregated {
		var result float64
		switch chart.Aggregate {
		case "sum":
			result = 0
			for _, v := range values {
				result += v
			}
		case "avg":
			result = 0
			for _, v := range values {
				result += v
			}
			result = result / float64(len(values))
		case "count":
			result = float64(len(values))
		case "max":
			result = values[0]
			for _, v := range values {
				if v > result {
					result = v
				}
			}
		case "min":
			result = values[0]
			for _, v := range values {
				if v < result {
					result = v
				}
			}
		default:
			result = 0
			for _, v := range values {
				result += v
			}
		}

		data = append(data, map[string]interface{}{
			chart.X: xVal,
			chart.Y: result,
		})
	}

	return data
}

// generateComboData generates data for combo charts (bar + line)
func (ae *AnalysisEngine) generateComboData(dataset *models.Dataset, chart *models.ChartConfig) []map[string]interface{} {
	xValues := dataset.GetColumnData(chart.X)
	yValues := dataset.GetColumnData(chart.Y)
	y2Values := dataset.GetColumnData(chart.Y2)

	if len(xValues) != len(yValues) {
		return []map[string]interface{}{}
	}

	data := make([]map[string]interface{}, 0, len(xValues))
	for i := 0; i < len(xValues) && i < 100; i++ {
		xVal := xValues[i]
		yVal, yErr := ae.toNumber(yValues[i])

		point := map[string]interface{}{
			chart.X: xVal,
			chart.Y: yVal,
		}

		if chart.Y2 != "" && i < len(y2Values) {
			y2Val, y2Err := ae.toNumber(y2Values[i])
			if y2Err == nil {
				point[chart.Y2] = y2Val
			}
		}

		if yErr == nil {
			data = append(data, point)
		}
	}

	return data
}

// generateBubbleData generates data for bubble charts
func (ae *AnalysisEngine) generateBubbleData(dataset *models.Dataset, chart *models.ChartConfig) []map[string]interface{} {
	xValues := dataset.GetColumnData(chart.X)
	yValues := dataset.GetColumnData(chart.Y)
	zValues := dataset.GetColumnData(chart.Z)

	if len(xValues) != len(yValues) || len(xValues) != len(zValues) {
		return []map[string]interface{}{}
	}

	data := make([]map[string]interface{}, 0, len(xValues))
	for i := 0; i < len(xValues) && i < 100; i++ {
		xVal, xErr := ae.toNumber(xValues[i])
		yVal, yErr := ae.toNumber(yValues[i])
		zVal, zErr := ae.toNumber(zValues[i])

		if xErr == nil && yErr == nil && zErr == nil {
			data = append(data, map[string]interface{}{
				chart.X: xVal,
				chart.Y: yVal,
				chart.Z: zVal,
			})
		}
	}

	return data
}

// generateHistogramData generates histogram data
func (ae *AnalysisEngine) generateHistogramData(dataset *models.Dataset, chart *models.ChartConfig) []map[string]interface{} {
	values := dataset.GetColumnData(chart.X)

	// Extract numeric values
	numbers := make([]float64, 0)
	for _, val := range values {
		if num, err := ae.toNumber(val); err == nil {
			numbers = append(numbers, num)
		}
	}

	if len(numbers) == 0 {
		return []map[string]interface{}{}
	}

	// Determine bins
	bins := chart.Bins
	if bins == 0 {
		bins = 20 // Default
	}

	// Find min and max
	min, max := numbers[0], numbers[0]
	for _, n := range numbers {
		if n < min {
			min = n
		}
		if n > max {
			max = n
		}
	}

	// Create bins
	binWidth := (max - min) / float64(bins)
	binCounts := make([]int, bins)

	// Count values in each bin
	for _, n := range numbers {
		binIndex := int((n - min) / binWidth)
		if binIndex >= bins {
			binIndex = bins - 1
		}
		if binIndex < 0 {
			binIndex = 0
		}
		binCounts[binIndex]++
	}

	// Create data points
	data := make([]map[string]interface{}, 0, bins)
	for i := 0; i < bins; i++ {
		binStart := min + float64(i)*binWidth
		binEnd := min + float64(i+1)*binWidth
		data = append(data, map[string]interface{}{
			"bin":   fmt.Sprintf("%.2f-%.2f", binStart, binEnd),
			"count": binCounts[i],
			"start": binStart,
			"end":   binEnd,
		})
	}

	return data
}

// generateBoxplotData generates boxplot data
func (ae *AnalysisEngine) generateBoxplotData(dataset *models.Dataset, chart *models.ChartConfig) []map[string]interface{} {
	values := dataset.GetColumnData(chart.Y)

	// Extract numeric values
	numbers := make([]float64, 0)
	for _, val := range values {
		if num, err := ae.toNumber(val); err == nil {
			numbers = append(numbers, num)
		}
	}

	if len(numbers) == 0 {
		return []map[string]interface{}{}
	}

	// Sort numbers
	sort.Float64s(numbers)

	// Calculate quartiles
	n := len(numbers)
	q1Idx := n / 4
	medianIdx := n / 2
	q3Idx := 3 * n / 4

	q1 := numbers[q1Idx]
	median := numbers[medianIdx]
	q3 := numbers[q3Idx]

	// Calculate IQR and outliers
	iqr := q3 - q1
	lowerFence := q1 - 1.5*iqr
	upperFence := q3 + 1.5*iqr

	// Find outliers
	outliers := make([]float64, 0)
	for _, n := range numbers {
		if n < lowerFence || n > upperFence {
			outliers = append(outliers, n)
		}
	}

	// Min and max within fences
	minVal := numbers[0]
	maxVal := numbers[n-1]
	for _, n := range numbers {
		if n >= lowerFence && n < minVal {
			minVal = n
		}
		if n <= upperFence && n > maxVal {
			maxVal = n
		}
	}

	return []map[string]interface{}{
		{
			"min":      minVal,
			"q1":       q1,
			"median":   median,
			"q3":       q3,
			"max":      maxVal,
			"outliers": outliers,
		},
	}
}

// generateCorrelationData generates correlation matrix data
func (ae *AnalysisEngine) generateCorrelationData(dataset *models.Dataset, chart *models.ChartConfig) []map[string]interface{} {
	if len(chart.Columns) == 0 {
		return []map[string]interface{}{}
	}

	// Get data for all columns
	columnData := make(map[string][]float64)
	for _, colName := range chart.Columns {
		values := dataset.GetColumnData(colName)
		numbers := make([]float64, 0)
		for _, val := range values {
			if num, err := ae.toNumber(val); err == nil {
				numbers = append(numbers, num)
			}
		}
		columnData[colName] = numbers
	}

	// Calculate correlation matrix
	data := make([]map[string]interface{}, 0)
	for _, col1 := range chart.Columns {
		row := map[string]interface{}{
			"column": col1,
		}
		for _, col2 := range chart.Columns {
			corr := ae.calculateCorrelation(columnData[col1], columnData[col2])
			row[col2] = corr
		}
		data = append(data, row)
	}

	return data
}

// calculateCorrelation calculates Pearson correlation coefficient
func (ae *AnalysisEngine) calculateCorrelation(x, y []float64) float64 {
	if len(x) != len(y) || len(x) == 0 {
		return 0
	}

	// Find common length
	minLen := len(x)
	if len(y) < minLen {
		minLen = len(y)
	}
	if minLen == 0 {
		return 0
	}

	// Calculate means
	var sumX, sumY float64
	for i := 0; i < minLen; i++ {
		sumX += x[i]
		sumY += y[i]
	}
	meanX := sumX / float64(minLen)
	meanY := sumY / float64(minLen)

	// Calculate correlation
	var numerator, sumSqX, sumSqY float64
	for i := 0; i < minLen; i++ {
		dx := x[i] - meanX
		dy := y[i] - meanY
		numerator += dx * dy
		sumSqX += dx * dx
		sumSqY += dy * dy
	}

	denominator := math.Sqrt(sumSqX * sumSqY)
	if denominator == 0 {
		return 0
	}

	return numerator / denominator
}

func (ae *AnalysisEngine) toNumber(val interface{}) (float64, error) {
	switch v := val.(type) {
	case float64:
		return v, nil
	case int:
		return float64(v), nil
	case string:
		return strconv.ParseFloat(v, 64)
	default:
		return strconv.ParseFloat(fmt.Sprintf("%v", v), 64)
	}
}
