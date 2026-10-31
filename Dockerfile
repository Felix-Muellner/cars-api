# The image that runs the API: Node.js 24, production dependencies only,
# started as the unprivileged "node" user. compose.yaml shows how to run it.
FROM node:24-slim

WORKDIR /app
ENV NODE_ENV=production

# package files first: Docker reuses this layer (and skips npm ci) when only the code changed
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY scripts ./scripts
COPY migrations ./migrations

# inside a container, 127.0.0.1 is unreachable from outside, so listen on all interfaces
ENV HOST=0.0.0.0 PORT=3000
EXPOSE 3000

USER node
# node runs as PID 1 and gets SIGTERM directly, so docker stop shuts down cleanly
CMD ["node", "src/server.js"]
