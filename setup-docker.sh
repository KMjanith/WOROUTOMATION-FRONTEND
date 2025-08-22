#!/bin/bash

# HUMMINGBIRD Docker Setup Script
set -e

echo "🐦 Setting up HUMMINGBIRD Docker Environment"

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

# Create .recipe directory if it doesn't exist
RECIPE_DIR="$HOME/.recipe"
if [ ! -d "$RECIPE_DIR" ]; then
    print_warning ".recipe directory not found. Creating it at $RECIPE_DIR"
    mkdir -p "$RECIPE_DIR"
    
    # Create sample configuration files
    echo "# Sample deployment configuration" > "$RECIPE_DIR/deployment.conf"
    echo "# Add your deployment settings here" >> "$RECIPE_DIR/deployment.conf"
    
    echo "overrides {" > "$RECIPE_DIR/overrides.conf"
    echo "  # Add your override settings here" >> "$RECIPE_DIR/overrides.conf"
    echo "}" >> "$RECIPE_DIR/overrides.conf"
    
    print_success "Created sample configuration files in $RECIPE_DIR"
fi

# Function to handle cleanup on exit
cleanup() {
    if [ $? -ne 0 ]; then
        print_error "Setup failed. Cleaning up..."
        docker-compose down --remove-orphans 2>/dev/null || true
    fi
}
trap cleanup EXIT

# Build and start the application
print_status "Building Docker images..."
if docker-compose build; then
    print_success "Docker images built successfully"
else
    print_error "Failed to build Docker images"
    exit 1
fi

print_status "Starting HUMMINGBIRD services..."
if docker-compose up -d; then
    print_success "Services started successfully"
else
    print_error "Failed to start services"
    exit 1
fi

# Wait for services to be ready
print_status "Waiting for services to be ready..."
sleep 10

# Check backend health
print_status "Checking backend health..."
for i in {1..30}; do
    if curl -s http://localhost:3001/api/health &> /dev/null; then
        print_success "Backend is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "Backend health check failed after 30 attempts"
        docker-compose logs backend
        exit 1
    fi
    sleep 2
done

# Check frontend
print_status "Checking frontend..."
for i in {1..30}; do
    if curl -s -I http://localhost/ &> /dev/null; then
        print_success "Frontend is accessible"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "Frontend health check failed after 30 attempts"
        docker-compose logs frontend
        exit 1
    fi
    sleep 2
done

# Show service status
print_status "Service Status:"
docker-compose ps

echo ""
print_success "🎉 HUMMINGBIRD is now running!"
echo ""
echo -e "${BLUE}Access the application:${NC}"
echo -e "  Frontend: ${GREEN}http://localhost${NC}"
echo -e "  Backend API: ${GREEN}http://localhost:3001${NC}"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo -e "  View logs: ${YELLOW}docker-compose logs -f${NC}"
echo -e "  Stop services: ${YELLOW}docker-compose down${NC}"
echo -e "  Restart services: ${YELLOW}docker-compose restart${NC}"
echo -e "  Check status: ${YELLOW}docker-compose ps${NC}"
echo ""
echo -e "${BLUE}Configuration files location:${NC} ${GREEN}$RECIPE_DIR${NC}"
