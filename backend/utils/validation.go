package utils

import (
	"fmt"
	"mime/multipart"
	"strings"
)

const maxFileSize = 10 * 1024 * 1024 // 10MB

// ValidateFile validates uploaded file
func ValidateFile(file *multipart.FileHeader) error {
	if file == nil {
		return fmt.Errorf("no file provided")
	}

	if file.Size > maxFileSize {
		return fmt.Errorf("file size exceeds 10MB limit")
	}

	filename := strings.ToLower(file.Filename)
	if !strings.HasSuffix(filename, ".csv") && !strings.HasSuffix(filename, ".xlsx") && !strings.HasSuffix(filename, ".xls") {
		return fmt.Errorf("unsupported file type. Only CSV and Excel files are allowed")
	}

	return nil
}

