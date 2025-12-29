package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/yourname/go-fiber-backend/backend/models"
	"github.com/yourname/go-fiber-backend/backend/services"
	"github.com/yourname/go-fiber-backend/backend/utils"
)

// getColumnNames extracts column names from dataset
func getColumnNames(dataset *models.Dataset) []string {
	columns := make([]string, len(dataset.Columns))
	for i, col := range dataset.Columns {
		columns[i] = col.Name
	}
	return columns
}

type AnalyzeHandler struct {
	storage        *services.FileStorage
	analysisEngine *services.AnalysisEngine
}

func NewAnalyzeHandler(storage *services.FileStorage, engine *services.AnalysisEngine) *AnalyzeHandler {
	return &AnalyzeHandler{
		storage:        storage,
		analysisEngine: engine,
	}
}

func (h *AnalyzeHandler) HandleAnalyze(c *fiber.Ctx) error {
	var req models.AnalyzeRequest
	if err := c.BodyParser(&req); err != nil {
		appErr := utils.NewAppError(
			utils.ErrorTypeValidation,
			"Invalid request body. Please check the request format.",
			400,
			err,
		)
		return utils.ErrorWithDetails(c, appErr)
	}

	if req.FileID == "" {
		appErr := utils.NewAppError(
			utils.ErrorTypeValidation,
			"fileId is required",
			400,
			nil,
		)
		return utils.ErrorWithDetails(c, appErr)
	}

	if req.Prompt == "" {
		appErr := utils.NewAppError(
			utils.ErrorTypeValidation,
			"prompt is required",
			400,
			nil,
		)
		return utils.ErrorWithDetails(c, appErr)
	}

	// Get dataset
	dataset, err := h.storage.GetDataset(req.FileID)
	if err != nil {
		appErr := utils.NewAppError(
			utils.ErrorTypeNotFound,
			"Dataset not found. The file may have expired or was not uploaded.",
			404,
			err,
		)
		appErr.Context["fileId"] = req.FileID
		return utils.ErrorWithDetails(c, appErr)
	}

	// Validate prompt relevance
	if err := utils.ValidatePrompt(req.Prompt, getColumnNames(dataset)); err != nil {
		if appErr, ok := err.(*utils.AppError); ok {
			return utils.ErrorWithDetails(c, appErr)
		}
		return utils.ErrorWithDetails(c, utils.NewAppError(
			utils.ErrorTypeValidation,
			err.Error(),
			400,
			err,
		))
	}

	// Process analysis
	result, err := h.analysisEngine.ProcessAnalysis(dataset, req.Prompt)
	if err != nil {
		appErr := utils.NewAppError(
			utils.ErrorTypeInternal,
			"Failed to process analysis. Please try again later.",
			500,
			err,
		)
		appErr.Context["fileId"] = req.FileID
		appErr.Context["prompt"] = req.Prompt
		return utils.ErrorWithDetails(c, appErr)
	}

	response := models.AnalyzeResponse{
		Insights:      result.Insights,
		Charts:        result.Charts,
		ChartStatus:   result.ChartStatus,
		ChartMessage:  result.ChartMessage,
		RetryAttempts: result.RetryAttempts,
	}

	return utils.Success(c, response)
}
