package services

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/google/uuid"
	"github.com/yourname/go-fiber-backend/backend/models"
)

// FileStorage manages temporary file storage
type FileStorage struct {
	storageDir string
	datasets   map[string]*models.Dataset
}

// NewFileStorage creates a new file storage instance
func NewFileStorage(storageDir string) *FileStorage {
	os.MkdirAll(storageDir, 0755)
	return &FileStorage{
		storageDir: storageDir,
		datasets:   make(map[string]*models.Dataset),
	}
}

// SaveFile saves uploaded file and parses it
func (fs *FileStorage) SaveFile(filePath string) (string, *models.Dataset, error) {
	fileID := uuid.New().String()

	dataset, err := models.ParseFile(filePath)
	if err != nil {
		return "", nil, fmt.Errorf("failed to parse file: %w", err)
	}

	// Store dataset in memory
	fs.datasets[fileID] = dataset

	return fileID, dataset, nil
}

// GetDataset retrieves dataset by file ID
func (fs *FileStorage) GetDataset(fileID string) (*models.Dataset, error) {
	dataset, exists := fs.datasets[fileID]
	if !exists {
		return nil, fmt.Errorf("dataset not found for fileId: %s", fileID)
	}
	return dataset, nil
}

// Cleanup removes temporary file
func (fs *FileStorage) Cleanup(filePath string) {
	os.Remove(filePath)
}

// GetTempPath returns a temporary file path
func (fs *FileStorage) GetTempPath(filename string) string {
	return filepath.Join(fs.storageDir, filename)
}

