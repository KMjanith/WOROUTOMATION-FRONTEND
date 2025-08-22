# Makefile for HUMMINGBIRD application

.PHONY: help build up down logs clean restart status

help: ## Show this help message
	@echo "HUMMINGBIRD Docker Management"
	@echo "Available commands:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build all Docker images
	docker-compose build --no-cache

up: ## Start all services
	docker-compose up -d

down: ## Stop all services
	docker-compose down

logs: ## Show logs from all services
	docker-compose logs -f

logs-backend: ## Show backend logs only
	docker-compose logs -f backend

logs-frontend: ## Show frontend logs only
	docker-compose logs -f frontend

restart: ## Restart all services
	docker-compose restart

restart-backend: ## Restart backend service only
	docker-compose restart backend

restart-frontend: ## Restart frontend service only
	docker-compose restart frontend

status: ## Show status of all services
	docker-compose ps

clean: ## Stop and remove containers, networks, and images
	docker-compose down --rmi all --volumes --remove-orphans

dev: ## Start in development mode (with build)
	docker-compose up --build

prod: ## Start in production mode
	docker-compose -f docker-compose.yml up -d

exec-backend: ## Execute bash in backend container
	docker-compose exec backend sh

exec-frontend: ## Execute bash in frontend container
	docker-compose exec frontend sh

health: ## Check health of all services
	@echo "Backend health:"
	@curl -s http://localhost:3001/api/health || echo "Backend not responding"
	@echo "\nFrontend health:"
	@curl -s -I http://localhost/ | head -n 1 || echo "Frontend not responding"
