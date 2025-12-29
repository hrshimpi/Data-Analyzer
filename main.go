package main

import (
	"log"
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/yourname/go-fiber-backend/backend/handlers"
	"github.com/yourname/go-fiber-backend/backend/middleware"
	"github.com/yourname/go-fiber-backend/backend/services"
)

func main() {

	app := fiber.New(fiber.Config{
		BodyLimit: 10 * 1024 * 1024, // 10MB
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			// Default error handler
			code := fiber.StatusInternalServerError
			message := "Internal Server Error"

			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
				message = e.Message
			}

			return c.Status(code).JSON(fiber.Map{
				"error":     message,
				"requestId": c.Locals("requestID"),
				"status":    code,
			})
		},
	})

	// Global middleware (order matters)
	app.Use(middleware.RequestID())  // Add request ID first
	app.Use(middleware.Logger())      // Log requests
	app.Use(middleware.Recovery())    // Recover from panics

	// CORS middleware - Production-ready configuration
	corsConfig := getCORSConfig()
	app.Use(cors.New(corsConfig))

	// Initialize services
	storage := services.NewFileStorage("./storage/temp")

	gemini, err := services.NewGeminiService()
	if err != nil {
		log.Fatalf("Failed to initialize Gemini service: %v", err)
	}
	defer gemini.Close()

	analysisEngine := services.NewAnalysisEngine(gemini)

	// Initialize handlers
	uploadHandler := handlers.NewUploadHandler(storage)
	suggestionsHandler := handlers.NewSuggestionsHandler(gemini)
	contextualSuggestionsHandler := handlers.NewContextualSuggestionsHandler(gemini)
	analyzeHandler := handlers.NewAnalyzeHandler(storage, analysisEngine)

	// Routes
	app.Post("/upload", uploadHandler.HandleUpload)
	app.Post("/suggestions", suggestionsHandler.HandleSuggestions)
	app.Post("/contextual-suggestions", contextualSuggestionsHandler.HandleContextualSuggestions)
	app.Post("/analyze", analyzeHandler.HandleAnalyze)

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	log.Println("Server starting on :3000")
	if err := app.Listen(":3000"); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

// getCORSConfig returns production-ready CORS configuration
func getCORSConfig() cors.Config {
	// Get allowed origins from environment variable
	// Format: "http://localhost:5173,https://example.com,https://app.example.com"
	allowedOriginsEnv := os.Getenv("CORS_ALLOWED_ORIGINS")
	
	var allowedOrigins []string
	
	if allowedOriginsEnv == "" {
		// Default: Allow localhost for development
		// In production, this should be set via environment variable
		allowedOrigins = []string{
			"http://localhost:5173",
			"http://localhost:3000",
			"http://127.0.0.1:5173",
			"http://127.0.0.1:3000",
		}
		log.Println("[CORS] Using default allowed origins (localhost) - Set CORS_ALLOWED_ORIGINS for production")
	} else {
		// Parse comma-separated origins
		origins := strings.Split(allowedOriginsEnv, ",")
		allowedOrigins = make([]string, 0, len(origins))
		for _, origin := range origins {
			origin = strings.TrimSpace(origin)
			if origin != "" {
				allowedOrigins = append(allowedOrigins, origin)
			}
		}
		log.Printf("[CORS] Allowed origins: %v", allowedOrigins)
	}

	// Get environment (development or production)
	env := os.Getenv("ENVIRONMENT")
	if env == "" {
		env = "development"
	}

	config := cors.Config{
		// Allowed origins
		AllowOrigins: strings.Join(allowedOrigins, ","),
		
		// Allowed HTTP methods
		AllowMethods: "GET,POST,OPTIONS",
		
		// Allowed headers
		AllowHeaders: "Content-Type,Authorization,X-Request-ID,Accept,Origin",
		
		// Exposed headers (headers that can be accessed by the frontend)
		ExposeHeaders: "X-Request-ID",
		
		// Allow credentials (cookies, authorization headers)
		// Set to false if you don't need credentials
		AllowCredentials: false,
		
		// Max age for preflight requests (in seconds)
		// 24 hours for production
		MaxAge: 86400,
		
		// Allow wildcard origins (only for development)
		AllowOriginsFunc: nil,
	}

	// Production-specific settings
	if env == "production" {
		// In production, be more strict
		config.AllowCredentials = false // Set to true if you need cookies/auth
		config.MaxAge = 86400           // 24 hours
		
		// Validate that origins are set
		if allowedOriginsEnv == "" {
			log.Println("[WARNING] CORS_ALLOWED_ORIGINS not set in production! Using default localhost origins.")
		}
	} else {
		// Development: More permissive
		config.MaxAge = 3600 // 1 hour for development
	}

	return config
}
