FROM oven/bun:alpine AS runner
WORKDIR /app

# Copy package specifications
COPY package.json ./

# Install production dependencies
RUN bun install --production

# Copy source files
COPY src/ ./src/

# Drop privileges to non-root user
USER bun

EXPOSE 8080

CMD ["bun", "run", "src/container.ts"]
