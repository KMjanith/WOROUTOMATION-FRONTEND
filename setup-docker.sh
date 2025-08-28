#!/bin/bash

# HUMMINGBIRD Development Docker Setup Script
set -e

# --- Configuration ---
DOCKER_COMPOSE_FILE="docker-compose.dev.yml"

echo "🐦 Setting up HUMMINGBIRD Docker Environment for Development"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    print_error "Docker daemon is not running. Please start Docker first."
    exit 1
fi

print_status "Docker and Docker Compose are available"

# Function to handle cleanup on exit
cleanup() {
    if [ $? -ne 0 ]; then
        print_error "Setup failed. Cleaning up..."
        docker-compose -f $DOCKER_COMPOSE_FILE down --remove-orphans 2>/dev/null || true
    fi
}
trap cleanup EXIT

# Build and start the application
print_status "Building and starting services with $DOCKER_COMPOSE_FILE..."
if docker-compose -f $DOCKER_COMPOSE_FILE up --build -d; then
    print_success "Services started successfully"
else
    print_error "Failed to build or start services"
    exit 1
fi

# Wait for services to be ready
print_status "Waiting for services to be ready..."
sleep 10

# Check backend health
print_status "Checking backend health..."
for i in {1..30}; do
    # Use the internal service name for health checks within Docker
    if curl -s http://localhost:3001/api/health &> /dev/null; then
        print_success "Backend is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "Backend health check failed after 30 attempts"
        docker-compose -f $DOCKER_COMPOSE_FILE logs backend
        exit 1
    fi
    sleep 2
done

# Check frontend health
print_status "Checking frontend..."
for i in {1..30}; do
    # Use the exposed port for the health check
    if curl -s -I http://localhost:5173 &> /dev/null; then
        print_success "Frontend is accessible"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "Frontend health check failed after 30 attempts"
        docker-compose -f $DOCKER_COMPOSE_FILE logs frontend
        exit 1
    fi
    sleep 2
done

# Show service status
print_status "Service Status:"
docker-compose -f $DOCKER_COMPOSE_FILE ps

echo ""
print_success "🎉 HUMMINGBIRD is now running!"
echo ""
echo -e "${BLUE}Access the application:${NC}"
echo -e "  Frontend: ${GREEN}http://localhost:5173${NC}"
echo -e "  Backend API: ${GREEN}http://localhost:3001${NC}"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo -e "  View logs: ${YELLOW}docker-compose -f $DOCKER_COMPOSE_FILE logs -f${NC}"
echo -e "  Stop services: ${YELLOW}docker-compose -f $DOCKER_COMPOSE_FILE down${NC}"
echo -e "  Restart services: ${YELLOW}docker-compose -f $DOCKER_COMPOSE_FILE restart${NC}"
echo -e "  Check status: ${YELLOW}docker-compose -f $DOCKER_COMPOSE_FILE ps${NC}"
echo ""