FROM oven/bun:alpine AS runner
WORKDIR /app

# Copy package specifications
COPY package.json ./

# Install production dependencies
RUN bun install --production

# Copy source and container entrypoint
COPY src/ ./src/
COPY container/ ./container/

# Drop privileges to non-root user
USER bun

EXPOSE 8080

CMD ["bun", "run", "container/index.ts"]
