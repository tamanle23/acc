FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm

FROM base AS builder
RUN apk add --no-cache libc6-compat
RUN apk update
WORKDIR /app
RUN pnpm add -g turbo
COPY . .
RUN turbo prune tekgo-ui --docker

FROM base AS installer
RUN apk add --no-cache libc6-compat
RUN apk update
WORKDIR /app

# First install the dependencies (as they change less often)
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile

# Build the project
COPY --from=builder /app/out/full/ .
RUN pnpm turbo build --filter=tekgo-ui

FROM base AS runner
WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 astrouser
USER astrouser

COPY --from=installer --chown=astrouser:nodejs /app/apps/tekgo-ui/dist ./apps/tekgo-ui/dist
COPY --from=installer --chown=astrouser:nodejs /app/apps/tekgo-ui/package.json ./apps/tekgo-ui/package.json

EXPOSE 4321
ENV PORT=4321
ENV HOST=0.0.0.0

CMD ["node", "apps/tekgo-ui/dist/server/entry.mjs"]
