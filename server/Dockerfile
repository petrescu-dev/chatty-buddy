# Voice Chat Agent Server
# Node.js + Fastify + TypeScript
# Includes built frontend static files
#
# Build context should be project root:
#   docker build -f server/Dockerfile -t chatty-buddy-server .

# Stage 1: Build frontend
FROM node:22-alpine AS frontend-builder

WORKDIR /frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build

# Stage 2: Server
FROM node:22-alpine

WORKDIR /app

# Copy server package files
COPY server/package*.json ./

# Install server dependencies
RUN npm ci

# Copy server source files
COPY server/tsconfig.json ./
COPY server/src ./src

# Copy built frontend from previous stage
COPY --from=frontend-builder /frontend/dist ./public

# Set environment variable for frontend directory
ENV FRONTEND_DIR=/app/public

# Expose port
EXPOSE 3001

# Run server
CMD ["npm", "run", "dev"]
