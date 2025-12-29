package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/yourname/go-fiber-backend/backend/models"
	"github.com/yourname/go-fiber-backend/backend/services"
	"github.com/yourname/go-fiber-backend/backend/utils"
)

type SuggestionsHandler struct {
	gemini *services.GeminiService
}

func NewSuggestionsHandler(gemini *services.GeminiService) *SuggestionsHandler {
	return &SuggestionsHandler{
		gemini: gemini,
	}
}

func (h *SuggestionsHandler) HandleSuggestions(c *fiber.Ctx) error {
	var req models.SuggestionsRequest
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

	if len(req.Columns) == 0 {
		appErr := utils.NewAppError(
			utils.ErrorTypeValidation,
			"columns are required",
			400,
			nil,
		)
		return utils.ErrorWithDetails(c, appErr)
	}

	suggestions, err := h.gemini.GetSuggestions(req.Columns, req.Summary)
	if err != nil {
		appErr := utils.NewAppError(
			utils.ErrorTypeExternal,
			"Failed to generate suggestions. Please try again later.",
			500,
			err,
		)
		appErr.Context["fileId"] = req.FileID
		return utils.ErrorWithDetails(c, appErr)
	}

	response := models.SuggestionsResponse{
		Suggestions: suggestions,
	}

	return utils.Success(c, response)
}

