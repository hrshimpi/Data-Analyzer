package middleware

import (
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
)

// Logger middleware logs HTTP requests with enhanced context
func Logger() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		requestID := c.Locals("requestID")

		// Process request
		err := c.Next()

		// Calculate duration
		duration := time.Since(start)

		// Log request with context
		statusCode := c.Response().StatusCode()
		logLevel := "INFO"
		if statusCode >= 400 {
			logLevel = "ERROR"
		}

		log.Printf("[%s] RequestID: %v | %s %s | IP: %s | Status: %d | Duration: %v",
			logLevel,
			requestID,
			c.Method(),
			c.Path(),
			c.IP(),
			statusCode,
			duration,
		)

		return err
	}
}

