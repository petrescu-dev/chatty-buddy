# Voice Chat Agent Server
# Node.js + Fastify + TypeScript

FROM node:24-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Expose port
EXPOSE 3001

# Run in development mode with hot reload
CMD ["npm", "run", "dev"]
