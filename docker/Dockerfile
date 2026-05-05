FROM node:22-bookworm-slim

# bcrypt 等原生模块在 slim 镜像里可能需要本地编译
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

ARG PNPM_VERSION=10.17.0
RUN npm config set registry https://registry.npmmirror.com \
  && npm install -g pnpm@${PNPM_VERSION}

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY .npmrc ./
RUN pnpm install --frozen-lockfile --prod

COPY scripts ./scripts
COPY src ./src
COPY docs ./docs

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "src/server.js"]
