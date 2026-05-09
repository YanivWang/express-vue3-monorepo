FROM node:22-bookworm-slim

# bcrypt 等原生模块在 slim 镜像里可能需要本地编译
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

ARG PNPM_VERSION=10.17.0
RUN npm config set registry https://registry.npmmirror.com \
  && npm install -g pnpm@${PNPM_VERSION}

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY .npmrc ./
COPY apps/backend/rest-api/package.json apps/backend/rest-api/
COPY apps/frontend/pc-portal/package.json apps/frontend/pc-portal/
COPY apps/frontend/pc-admin/package.json apps/frontend/pc-admin/
RUN pnpm install --frozen-lockfile --prod --filter @express-vue3-monorepo/rest-api

COPY apps/backend/rest-api ./apps/backend/rest-api
COPY docs ./docs

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["pnpm", "--filter", "@express-vue3-monorepo/rest-api", "start"]
