FROM node:22-bookworm-slim

# bcrypt 等原生模块在 slim 镜像里可能需要本地编译
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY src ./src
COPY docs ./docs

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "src/server.js"]
