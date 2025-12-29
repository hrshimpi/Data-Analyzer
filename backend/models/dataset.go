package models

import (
	"encoding/csv"
	"fmt"
	"math"
	"os"
	"sort"
	"strconv"
	"strings"

	"github.com/xuri/excelize/v2"
)

// Dataset represents the parsed dataset
type Dataset struct {
	Columns []ColumnInfo
	Rows    [][]interface{}
	Summary map[string]SummaryStats
}

// ParseFile parses CSV or Excel file and returns Dataset
func ParseFile(filePath string) (*Dataset, error) {
	if strings.HasSuffix(strings.ToLower(filePath), ".csv") {
		return parseCSV(filePath)
	}
	return parseExcel(filePath)
}

func parseCSV(filePath string) (*Dataset, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		return nil, err
	}

	if len(records) == 0 {
		return nil, fmt.Errorf("empty CSV file")
	}

	headers := records[0]
	rows := records[1:]

	dataset := &Dataset{
		Columns: make([]ColumnInfo, len(headers)),
		Rows:    make([][]interface{}, len(rows)),
		Summary: make(map[string]SummaryStats),
	}

	// Initialize columns
	for i, header := range headers {
		dataset.Columns[i] = ColumnInfo{
			Name: strings.TrimSpace(header),
			Type: "string", // Will be inferred later
		}
	}

	// Parse rows
	for i, row := range rows {
		dataset.Rows[i] = make([]interface{}, len(headers))
		for j, val := range row {
			dataset.Rows[i][j] = strings.TrimSpace(val)
		}
	}

	// Infer types and calculate stats
	dataset.inferTypesAndStats()

	return dataset, nil
}

func parseExcel(filePath string) (*Dataset, error) {
	f, err := excelize.OpenFile(filePath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	sheetName := f.GetSheetName(0)
	if sheetName == "" {
		return nil, fmt.Errorf("no sheets found in Excel file")
	}

	rows, err := f.GetRows(sheetName)
	if err != nil {
		return nil, err
	}

	if len(rows) == 0 {
		return nil, fmt.Errorf("empty Excel file")
	}

	headers := rows[0]
	dataRows := rows[1:]

	dataset := &Dataset{
		Columns: make([]ColumnInfo, len(headers)),
		Rows:    make([][]interface{}, len(dataRows)),
		Summary: make(map[string]SummaryStats),
	}

	// Initialize columns
	for i, header := range headers {
		dataset.Columns[i] = ColumnInfo{
			Name: strings.TrimSpace(header),
			Type: "string",
		}
	}

	// Parse rows
	for i, row := range dataRows {
		dataset.Rows[i] = make([]interface{}, len(headers))
		for j := 0; j < len(headers); j++ {
			if j < len(row) {
				dataset.Rows[i][j] = strings.TrimSpace(row[j])
			} else {
				dataset.Rows[i][j] = ""
			}
		}
	}

	// Infer types and calculate stats
	dataset.inferTypesAndStats()

	return dataset, nil
}

func (d *Dataset) inferTypesAndStats() {
	if len(d.Columns) == 0 || len(d.Rows) == 0 {
		return
	}

	for colIdx, col := range d.Columns {
		values := make([]interface{}, 0, len(d.Rows))
		for _, row := range d.Rows {
			if colIdx < len(row) {
				values = append(values, row[colIdx])
			}
		}

		stats := d.calculateStats(col.Name, values)
		d.Summary[col.Name] = stats

		// Infer type based on stats
		if stats.Mean != nil {
			d.Columns[colIdx].Type = "number"
		} else {
			d.Columns[colIdx].Type = "string"
		}
	}
}

func (d *Dataset) calculateStats(columnName string, values []interface{}) SummaryStats {
	stats := SummaryStats{
		TotalCount: len(values),
		NullCount:  0,
	}

	// Try to parse as numbers
	numbers := make([]float64, 0)
	uniqueStrings := make(map[string]bool)

	for _, val := range values {
		strVal := fmt.Sprintf("%v", val)
		if strVal == "" || strVal == "null" || strVal == "NULL" {
			stats.NullCount++
			continue
		}

		if num, err := strconv.ParseFloat(strVal, 64); err == nil {
			numbers = append(numbers, num)
		} else {
			uniqueStrings[strVal] = true
		}
	}

	// If we have numbers, calculate numeric stats
	if len(numbers) > 0 {
		sort.Float64s(numbers)
		min := numbers[0]
		max := numbers[len(numbers)-1]

		var sum float64
		for _, n := range numbers {
			sum += n
		}
		mean := sum / float64(len(numbers))

		// Calculate median
		var median float64
		if len(numbers)%2 == 0 {
			median = (numbers[len(numbers)/2-1] + numbers[len(numbers)/2]) / 2
		} else {
			median = numbers[len(numbers)/2]
		}

		// Calculate standard deviation
		var variance float64
		for _, n := range numbers {
			variance += math.Pow(n-mean, 2)
		}
		stdDev := math.Sqrt(variance / float64(len(numbers)))

		stats.Min = &min
		stats.Max = &max
		stats.Mean = &mean
		stats.Median = &median
		stats.StdDev = &stdDev
	} else {
		// String stats
		uniqueCount := len(uniqueStrings)
		stats.UniqueCount = &uniqueCount
	}

	return stats
}

// GetColumnData returns all values for a specific column
func (d *Dataset) GetColumnData(columnName string) []interface{} {
	colIdx := -1
	for i, col := range d.Columns {
		if col.Name == columnName {
			colIdx = i
			break
		}
	}

	if colIdx == -1 {
		return nil
	}

	values := make([]interface{}, 0, len(d.Rows))
	for _, row := range d.Rows {
		if colIdx < len(row) {
			values = append(values, row[colIdx])
		}
	}
	return values
}

