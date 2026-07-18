# Single-container image: NestJS serves both API (/api) and React frontend (/)
# Build context must be the repo root:
#   docker build -t dmc-crm .
#   docker compose up

# ─── Shared base ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ─── Frontend: install & build ────────────────────────────────────────────────
FROM base AS frontend-build
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
RUN npm ci
COPY frontend ./frontend
WORKDIR /app/frontend
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ─── Backend: install all deps (needed for nest build) ───────────────────────
FROM base AS backend-deps
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
RUN npm ci

# ─── Backend: compile TypeScript ─────────────────────────────────────────────
FROM base AS backend-build
COPY --from=backend-deps /app/node_modules ./node_modules
COPY --from=backend-deps /app/backend/node_modules ./backend/node_modules
COPY package.json package-lock.json ./
COPY backend ./backend
WORKDIR /app/backend
RUN npm run build

# ─── Production runner ────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
# npm workspaces hoists all packages to root node_modules;
# copy it alongside the dist so Node's upward resolver finds everything
COPY --from=backend-build /app/node_modules /app/node_modules
COPY --from=backend-build /app/backend/dist /app/backend/dist
COPY --from=frontend-build /app/frontend/dist /app/backend/public
COPY backend/package.json /app/backend/
WORKDIR /app/backend
USER node
EXPOSE 8080
CMD ["node", "dist/main.js"]
