package utils

import (
	"github.com/gofiber/fiber/v2"
	"github.com/yourname/go-fiber-backend/backend/models"
)

// Success sends a success response
func Success(c *fiber.Ctx, data interface{}) error {
	return c.JSON(data)
}

// Error sends an error response with proper formatting
func Error(c *fiber.Ctx, status int, message string) error {
	requestID := c.Locals("requestID")
	if requestID == nil {
		requestID = "unknown"
	}

	response := models.ErrorResponse{
		Error:     message,
		RequestID: requestID.(string),
		Status:    status,
	}

	return c.Status(status).JSON(response)
}

// ErrorWithDetails sends an error response with additional details
func ErrorWithDetails(c *fiber.Ctx, appErr *AppError) error {
	requestID := c.Locals("requestID")
	if requestID == nil {
		requestID = "unknown"
	}

	appErr.RequestID = requestID.(string)

	// Log the error
	LogError(appErr, appErr.Context)

	response := models.ErrorResponse{
		Error:     appErr.Message,
		RequestID: appErr.RequestID,
		Status:    appErr.Code,
		Type:      string(appErr.Type),
	}

	return c.Status(appErr.Code).JSON(response)
}

