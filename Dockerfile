# ==============================================================================
# Production Dockerfile for Student Management MCP Server (student-mcp-server)
# Optimized for Render Cloud Container Deployment
# ==============================================================================
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Install curl for Docker healthchecks
RUN apk add --no-cache curl

# Copy package descriptors first for layer caching
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Expose MCP server port
EXPOSE 8080

# Health check inside container
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the MCP server
CMD ["node", "server.js"]
