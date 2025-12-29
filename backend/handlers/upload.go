package handlers

import (
	"os"
	"path/filepath"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/yourname/go-fiber-backend/backend/models"
	"github.com/yourname/go-fiber-backend/backend/services"
	"github.com/yourname/go-fiber-backend/backend/utils"
)

type UploadHandler struct {
	storage *services.FileStorage
}

func NewUploadHandler(storage *services.FileStorage) *UploadHandler {
	return &UploadHandler{
		storage: storage,
	}
}

func (h *UploadHandler) HandleUpload(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		appErr := utils.NewAppError(
			utils.ErrorTypeValidation,
			"No file provided. Please select a file to upload.",
			400,
			err,
		)
		return utils.ErrorWithDetails(c, appErr)
	}

	if err := utils.ValidateFile(file); err != nil {
		appErr := utils.NewAppError(
			utils.ErrorTypeValidation,
			err.Error(),
			400,
			err,
		)
		appErr.Context["filename"] = file.Filename
		appErr.Context["size"] = file.Size
		return utils.ErrorWithDetails(c, appErr)
	}

	// Save uploaded file temporarily
	tempDir := filepath.Join(".", "storage", "temp")
	os.MkdirAll(tempDir, 0755)

	tempFilename := uuid.New().String() + filepath.Ext(file.Filename)
	tempPath := filepath.Join(tempDir, tempFilename)

	if err := c.SaveFile(file, tempPath); err != nil {
		appErr := utils.NewAppError(
			utils.ErrorTypeInternal,
			"Failed to save uploaded file. Please try again.",
			500,
			err,
		)
		appErr.Context["filename"] = file.Filename
		return utils.ErrorWithDetails(c, appErr)
	}

	// Parse file
	fileID, dataset, err := h.storage.SaveFile(tempPath)
	if err != nil {
		os.Remove(tempPath)
		appErr := utils.NewAppError(
			utils.ErrorTypeInternal,
			"Failed to parse file. Please ensure the file is a valid CSV or Excel file.",
			500,
			err,
		)
		appErr.Context["filename"] = file.Filename
		appErr.Context["tempPath"] = tempPath
		return utils.ErrorWithDetails(c, appErr)
	}

	// Cleanup temp file
	h.storage.Cleanup(tempPath)

	// Build response
	response := models.UploadResponse{
		FileID:   fileID,
		FileName: file.Filename,
		Columns:  dataset.Columns,
		Summary:  dataset.Summary,
	}

	return utils.Success(c, response)
}
