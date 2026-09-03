# ==============================================================================
# Contratics Web - Multi-stage Production Dockerfile
# Stage 1: Build React/Vite application
# Stage 2: Serve with lightweight Nginx Alpine
# ==============================================================================

# Build Stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install dependencies
RUN npm ci --prefer-offline --no-audit

# Copy source code and assets
COPY . .

# Build Vite application for production
RUN npm run build

# Production Stage
FROM nginx:1.27-alpine AS runner

# Remove default nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy build artifacts from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 (mapped to 3000 in docker-compose)
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
