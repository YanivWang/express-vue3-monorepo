# apps/backend/rest-api 生产镜像（多阶段）
# 构建上下文为仓库根目录：
#   docker build -f docker/Dockerfile .
#
# 三个阶段的分工：
#   builder    —— 装全量依赖（含 devDependencies）并编译 TS，产出各包的 dist；
#   prod-deps  —— 只装生产依赖，与 builder 同为 /app 布局，使 pnpm 的相对软链在拷贝后依然有效；
#   runtime    —— 不含编译工具链与 devDependencies，非 root 运行。
#
# 注意：rest-api 依赖 workspace 包 @express-vue3-monorepo/shared，因此 packages/ 必须进入构建上下文。
# 早期版本漏拷 packages/ 时 pnpm 会装出「悬空软链」使 install 假成功、tsc 报 TS2307 而构建失败，
# CI（.github/workflows/ci.yml）的 docker build 作业即为防止该问题复发。

ARG NODE_VERSION=22-bookworm-slim
ARG PNPM_VERSION=10.17.0

# ──────────────────────────────────────────────────────────────
# 公共基底：pnpm + 原生模块（bcrypt）编译所需工具链
# ──────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS base
ARG PNPM_VERSION
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN npm config set registry https://registry.npmmirror.com \
  && npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app
# 镜像内无 git：避免根目录 prepare（husky）在 pnpm install 阶段报错
ENV HUSKY=0

# 仅清单文件先落盘，使依赖层可被 Docker 缓存复用（源码变更不会导致重装依赖）
FROM base AS manifests
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
# 根 package.json 的 prepare 钩子实现（生产安装缺 husky 时安静跳过）
COPY scripts/prepare-husky.mjs scripts/prepare-husky.mjs
COPY apps/backend/rest-api/package.json apps/backend/rest-api/
COPY apps/frontend/pc-portal/package.json apps/frontend/pc-portal/
COPY apps/frontend/pc-admin/package.json apps/frontend/pc-admin/
COPY packages/shared/package.json packages/shared/
COPY packages/request-core/package.json packages/request-core/
COPY packages/js-bridge/package.json packages/js-bridge/
COPY packages/web-monitor/package.json packages/web-monitor/

# ──────────────────────────────────────────────────────────────
# builder：全量依赖 + 编译
# ──────────────────────────────────────────────────────────────
FROM manifests AS builder
# `pkg...` = 该包及其 workspace 依赖（shared、request-core）
RUN pnpm install --frozen-lockfile --filter "@express-vue3-monorepo/rest-api..."

COPY tsconfig.base.json tsconfig.pkg.json ./
COPY packages/shared packages/shared
COPY packages/request-core packages/request-core
COPY apps/backend/rest-api apps/backend/rest-api

# 按拓扑序构建：request-core、shared 先出 dist，rest-api 的 tsc 才能解析到类型
RUN pnpm --filter "@express-vue3-monorepo/rest-api..." run --if-present build

# ──────────────────────────────────────────────────────────────
# prod-deps：仅生产依赖（node_modules 会被整体拷入 runtime）
# ──────────────────────────────────────────────────────────────
FROM manifests AS prod-deps
RUN pnpm install --frozen-lockfile --prod --filter "@express-vue3-monorepo/rest-api..."

# ──────────────────────────────────────────────────────────────
# runtime：无工具链、无 devDependencies、非 root
# ──────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV APP_ENV=production
ENV PORT=3000

# 与 builder/prod-deps 同为 /app，pnpm 的相对软链拷贝后依然指向正确目标
COPY --from=prod-deps --chown=node:node /app /app

# 各包编译产物（package.json 的 `node` 导出条件指向这些 dist）
COPY --from=builder --chown=node:node /app/packages/request-core/dist packages/request-core/dist
COPY --from=builder --chown=node:node /app/packages/shared/dist packages/shared/dist
COPY --from=builder --chown=node:node /app/apps/backend/rest-api/dist apps/backend/rest-api/dist

# swagger.ts 按 monorepo 根定位 docs/openapi.yaml
COPY --chown=node:node docs docs

# uploads/ 与 logs/ 落在 monorepo 根（src/utils/projectRoot.ts），需对非 root 可写。
# 生产应通过 compose 的具名卷挂载 /app/uploads，否则容器重建即丢文件。
RUN mkdir -p uploads logs && chown -R node:node uploads logs

USER node

EXPOSE 3000

# 复用 src/routes/health.routes.ts 的存活探针（不触库，故不受 DB 抖动影响）
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# 直接 exec node：让 PID 1 收到 SIGTERM，避免经 pnpm/sh 转发丢失优雅退出信号
CMD ["node", "apps/backend/rest-api/dist/server.js"]
