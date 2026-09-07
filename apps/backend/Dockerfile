# Stage 1: Build
FROM node:22-alpine AS builder

RUN apk add --no-cache openssl

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc* ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install

COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

RUN pnpm --filter @ad-utility/shared build
RUN pnpm --filter @ad-utility/backend prisma:generate
RUN pnpm --filter @ad-utility/backend build

# Stage 2: Runner
FROM node:22-alpine AS runner

RUN apk add --no-cache openssl

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc* ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --prod

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

USER node

EXPOSE 4000

CMD ["node", "apps/backend/dist/main.js"]
