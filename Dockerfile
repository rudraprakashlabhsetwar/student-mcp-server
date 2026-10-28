# ==============================================================================
# Production Dockerfile for Student Management MCP Server (student-mcp-server)
# Optimized for Render Cloud Container Deployment
# ==============================================================================
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install curl for healthchecks
RUN apk add --no-cache curl

# Copy package descriptors first for layer caching
COPY package*.json ./

# Install production dependencies cleanly
RUN npm ci --only=production

# Copy application source code
COPY . .

# Expose MCP server port
EXPOSE 8080 10000

# Container healthcheck adapts dynamically to $PORT
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD sh -c "curl -f http://127.0.0.1:${PORT:-8080}/health || exit 1"

# Start the MCP server
CMD ["node", "server.js"]
