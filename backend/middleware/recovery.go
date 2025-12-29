package middleware

import (
	"log"
	"runtime/debug"

	"github.com/gofiber/fiber/v2"
	"github.com/yourname/go-fiber-backend/backend/utils"
)

// Recovery middleware recovers from panics and returns a proper error response
func Recovery() fiber.Handler {
	return func(c *fiber.Ctx) error {
		defer func() {
			if r := recover(); r != nil {
				// Log the panic with full context
				requestID := c.Locals("requestID")
				log.Printf("[PANIC] RequestID: %v, Path: %s, Method: %s, Error: %v\n%s",
					requestID, c.Path(), c.Method(), r, debug.Stack())

				// Return error response
				appErr := utils.NewAppError(
					utils.ErrorTypeInternal,
					"An unexpected error occurred. Please try again later.",
					500,
					nil,
				)
				appErr.Context["panic"] = r
				appErr.Context["path"] = c.Path()
				appErr.Context["method"] = c.Method()
				appErr.Context["ip"] = c.IP()

				utils.LogError(appErr, appErr.Context)
				utils.ErrorWithDetails(c, appErr)
			}
		}()

		return c.Next()
	}
}

