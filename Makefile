.PHONY: help install dev build clean db-up db-down db-migrate db-seed db-studio

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install all dependencies
	npm install

dev: ## Run both backend and frontend in development mode
	npm run dev

dev-backend: ## Run only backend in development mode
	npm run dev:backend

dev-frontend: ## Run only frontend in development mode
	npm run dev:frontend

build: ## Build both backend and frontend
	npm run build

clean: ## Remove node_modules and build artifacts
	rm -rf node_modules backend/node_modules frontend/node_modules
	rm -rf backend/dist frontend/.next

db-up: ## Start PostgreSQL database with Docker Compose
	docker-compose up -d

db-down: ## Stop PostgreSQL database
	docker-compose down

db-migrate: ## Run database migrations
	npm run db:migrate --workspace=backend

db-seed: ## Seed the database with sample data
	npm run db:seed --workspace=backend

db-studio: ## Open Prisma Studio (database GUI)
	npm run db:studio --workspace=backend

setup: db-up ## Complete setup: start DB, install deps, migrate, seed
	@echo "Waiting for database to be ready..."
	@sleep 3
	npm install
	npm run db:migrate --workspace=backend
	npm run db:seed --workspace=backend
	@echo ""
	@echo "✅ Setup complete! Run 'make dev' to start the application."
