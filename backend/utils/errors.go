package utils

import (
	"errors"
	"fmt"
	"log"
	"runtime"
	"strings"
)

// ErrorType represents the type of error
type ErrorType string

const (
	ErrorTypeValidation   ErrorType = "VALIDATION_ERROR"
	ErrorTypeNotFound     ErrorType = "NOT_FOUND"
	ErrorTypeUnauthorized ErrorType = "UNAUTHORIZED"
	ErrorTypeInternal     ErrorType = "INTERNAL_ERROR"
	ErrorTypeExternal     ErrorType = "EXTERNAL_ERROR"
	ErrorTypeBadRequest   ErrorType = "BAD_REQUEST"
)

// AppError represents an application error with context
type AppError struct {
	Type      ErrorType
	Message   string
	Err       error
	Code      int
	RequestID string
	Context   map[string]interface{}
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s (original: %v)", e.Type, e.Message, e.Err)
	}
	return fmt.Sprintf("%s: %s", e.Type, e.Message)
}

// NewAppError creates a new application error
func NewAppError(errType ErrorType, message string, code int, err error) *AppError {
	return &AppError{
		Type:    errType,
		Message: message,
		Err:     err,
		Code:    code,
		Context: make(map[string]interface{}),
	}
}

// LogError logs an error with stack trace and context
func LogError(err error, context map[string]interface{}) {
	// Get caller information
	pc, file, line, ok := runtime.Caller(1)
	if ok {
		funcName := runtime.FuncForPC(pc).Name()
		log.Printf("[ERROR] %s:%d %s - %v", file, line, funcName, err)
	} else {
		log.Printf("[ERROR] %v", err)
	}

	// Log context if provided
	if context != nil && len(context) > 0 {
		log.Printf("[ERROR CONTEXT] %+v", context)
	}

	// Log stack trace for internal errors
	if appErr, ok := err.(*AppError); ok && appErr.Type == ErrorTypeInternal {
		buf := make([]byte, 4096)
		n := runtime.Stack(buf, false)
		log.Printf("[STACK TRACE]\n%s", buf[:n])
	}
}

// IsRelevantPrompt checks if a prompt is relevant to data analysis
func IsRelevantPrompt(prompt string, datasetColumns []string) bool {
	prompt = strings.ToLower(strings.TrimSpace(prompt))
	
	// Check if prompt is too short
	if len(prompt) < 3 {
		return false
	}

	// Irrelevant patterns
	irrelevantPatterns := []string{
		"what is the weather",
		"tell me a joke",
		"what time is it",
		"how are you",
		"what's your name",
		"who are you",
		"what can you do",
		"help me with",
		"explain quantum physics",
		"write a poem",
		"translate",
		"calculate",
		"what is",
		"who is",
		"when did",
		"where is",
		"why did",
		"how to cook",
		"how to learn",
		"recipe for",
		"news about",
		"latest on",
		"tell me about history",
		"what happened in",
	}

	// Check against irrelevant patterns
	for _, pattern := range irrelevantPatterns {
		if strings.Contains(prompt, pattern) {
			return false
		}
	}

	// Check if prompt mentions data-related keywords
	dataKeywords := []string{
		"data", "dataset", "column", "row", "value", "average", "mean", "sum",
		"count", "max", "min", "chart", "graph", "plot", "analyze", "analysis",
		"correlation", "trend", "distribution", "compare", "show", "display",
		"visualize", "statistic", "statistics", "percentage", "ratio", "proportion",
	}

	hasDataKeyword := false
	for _, keyword := range dataKeywords {
		if strings.Contains(prompt, keyword) {
			hasDataKeyword = true
			break
		}
	}

	// Check if prompt mentions column names
	hasColumnMention := false
	for _, col := range datasetColumns {
		if strings.Contains(prompt, strings.ToLower(col)) {
			hasColumnMention = true
			break
		}
	}

	// Prompt is relevant if it has data keywords or mentions columns
	return hasDataKeyword || hasColumnMention
}

// ValidatePrompt validates and checks if prompt is relevant
func ValidatePrompt(prompt string, datasetColumns []string) error {
	prompt = strings.TrimSpace(prompt)
	
	if prompt == "" {
		return NewAppError(ErrorTypeValidation, "Prompt cannot be empty", 400, nil)
	}

	if len(prompt) > 2000 {
		return NewAppError(ErrorTypeValidation, "Prompt is too long (max 2000 characters)", 400, nil)
	}

	if !IsRelevantPrompt(prompt, datasetColumns) {
		return NewAppError(
			ErrorTypeBadRequest,
			"This prompt doesn't seem related to data analysis. Please ask questions about your uploaded dataset, such as 'Show me the average sales by region' or 'What is the correlation between age and income?'",
			400,
			errors.New("irrelevant prompt"),
		)
	}

	return nil
}

