package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/yourname/go-fiber-backend/backend/models"
	"github.com/yourname/go-fiber-backend/backend/services"
	"github.com/yourname/go-fiber-backend/backend/utils"
)

type ContextualSuggestionsHandler struct {
	gemini *services.GeminiService
}

func NewContextualSuggestionsHandler(gemini *services.GeminiService) *ContextualSuggestionsHandler {
	return &ContextualSuggestionsHandler{
		gemini: gemini,
	}
}

func (h *ContextualSuggestionsHandler) HandleContextualSuggestions(c *fiber.Ctx) error {
	var req models.ContextualSuggestionsRequest
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

	if len(req.RecentChats) == 0 {
		appErr := utils.NewAppError(
			utils.ErrorTypeValidation,
			"recentChats are required",
			400,
			nil,
		)
		return utils.ErrorWithDetails(c, appErr)
	}

	suggestions, err := h.gemini.GetContextualSuggestions(req.RecentChats)
	if err != nil {
		appErr := utils.NewAppError(
			utils.ErrorTypeExternal,
			"Failed to generate contextual suggestions. Please try again later.",
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

