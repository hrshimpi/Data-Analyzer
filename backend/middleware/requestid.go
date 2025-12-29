package middleware

import (
	"github.com/google/uuid"
	"github.com/gofiber/fiber/v2"
)

// RequestID middleware adds a unique request ID to each request
func RequestID() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Get or create request ID
		requestID := c.Get("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}

		// Set request ID in header
		c.Set("X-Request-ID", requestID)
		c.Locals("requestID", requestID)

		return c.Next()
	}
}

