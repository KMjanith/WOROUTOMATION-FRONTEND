# HUMMINGBIRD Docker Setup

This guide explains how to run the HUMMINGBIRD application using Docker.

## Prerequisites

- Docker (version 20.10 or later)
- Docker Compose (version 2.0 or later)
- Git

## Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd WOROUTOMATION-FRONTEND

# Run the automated setup script
./setup-docker.sh
```

### Option 2: Manual Setup

```bash
# Build and start services
docker-compose up --build -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

## Available Services

- **Frontend**: React application served by Nginx (Port 80)
- **Backend**: Node.js Express API (Port 3001)

## Environment Configurations

### Production (Default)
```bash
docker-compose up -d
```

### Development
```bash
docker-compose -f docker-compose.dev.yml up -d
```

## Useful Commands

### Using Docker Compose

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart services
docker-compose restart

# Rebuild and start
docker-compose up --build -d

# Check service status
docker-compose ps

# Execute commands in containers
docker-compose exec backend sh
docker-compose exec frontend sh
```

### Using Makefile

```bash
# Show available commands
make help

# Build images
make build

# Start services
make up

# Stop services
make down

# View logs
make logs

# Check health
make health

# Clean everything
make clean
```

## Directory Structure

```
.
├── Dockerfile              # Frontend production Dockerfile
├── Dockerfile.dev          # Frontend development Dockerfile
├── backend/
│   ├── Dockerfile          # Backend Dockerfile
│   ├── server.js           # Backend application
│   └── package.json
├── docker-compose.yml      # Production compose file
├── docker-compose.dev.yml  # Development compose file
├── nginx.conf              # Nginx configuration
├── setup-docker.sh         # Automated setup script
├── Makefile               # Docker management commands
├── .env.production        # Production environment variables
└── .env.development       # Development environment variables
```

## Configuration

### Recipe Directory

The application expects configuration files in `~/.recipe/`:
- `deployment.conf`
- `overrides.conf`

These files are automatically created with sample content if they don't exist.

### Environment Variables

#### Production (.env.production)
- `NODE_ENV=production`
- `PORT=3001`
- `CORS_ORIGIN=http://localhost`

#### Development (.env.development)
- `NODE_ENV=development`
- `PORT=3001`
- `CORS_ORIGIN=http://localhost:5173`

## Docker Volumes

- **Docker Socket**: `/var/run/docker.sock` - Allows the app to manage Docker containers
- **Recipe Directory**: `~/.recipe` - Configuration files directory

## Networking

Both services communicate through a custom Docker network `hummingbird-network`.

### Port Mapping

- **Frontend**: `localhost:80` → `container:80`
- **Backend**: `localhost:3001` → `container:3001`
- **Frontend Dev**: `localhost:5173` → `container:5173` (development only)

## Health Checks

The backend includes health checks:
- **Endpoint**: `/api/health`
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Check what's using the port
   sudo lsof -i :80
   sudo lsof -i :3001
   
   # Stop conflicting services or change ports in docker-compose.yml
   ```

2. **Permission denied for Docker socket**
   ```bash
   # Add user to docker group
   sudo usermod -aG docker $USER
   
   # Restart session or run
   newgrp docker
   ```

3. **Recipe directory not found**
   ```bash
   # Create the directory
   mkdir -p ~/.recipe
   
   # Create sample files
   echo "# Sample deployment config" > ~/.recipe/deployment.conf
   echo "overrides { }" > ~/.recipe/overrides.conf
   ```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last N lines
docker-compose logs --tail=50 backend
```

### Debugging

```bash
# Execute shell in container
docker-compose exec backend sh
docker-compose exec frontend sh

# Check container stats
docker stats

# Inspect containers
docker-compose ps
docker inspect hummingbird-backend
```

## Development Workflow

1. **Start development environment**:
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. **Make changes** to your code (files are mounted as volumes)

3. **View changes** automatically (hot reload enabled)

4. **Check logs**:
   ```bash
   make logs
   ```

## Production Deployment

1. **Build optimized images**:
   ```bash
   docker-compose build --no-cache
   ```

2. **Start production services**:
   ```bash
   docker-compose up -d
   ```

3. **Monitor health**:
   ```bash
   make health
   ```

## Security Considerations

- The application runs with a non-root user in containers
- Docker socket is mounted read-only for container management
- Nginx serves static files with proper caching headers
- CORS is configured for the appropriate origins

## Performance Optimization

- Multi-stage builds for smaller images
- Nginx gzip compression enabled
- Static asset caching configured
- Health checks for service readiness
- Restart policies for reliability
