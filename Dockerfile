# AI 兴国 · 在线对话（NextChat v2.16.1 + 面板会话自动取用户自己的 key）
#
# 做法：不 fork 上游历史，只在构建时浅克隆上游指定 tag，再用 overlay/ 覆盖若干文件。
# 覆盖内容见 README.md —— 相当于「重建设镜像」的正规做法，不需要改上游源码仓库。
FROM node:18-alpine AS base

# ── 取上游源码 + 叠加我们的补丁 ───────────────────────────────
FROM base AS source
RUN apk add --no-cache git libc6-compat
WORKDIR /app
ARG NEXTCHAT_VERSION=v2.16.1
RUN git clone --depth 1 --branch ${NEXTCHAT_VERSION} \
      https://github.com/ChatGPTNextWeb/NextChat.git . \
 && rm -rf .git

COPY overlay/ /overlay/
RUN cp -a /overlay/. /app/ && rm -rf /app/overlay \
 && echo "── overlay 生效文件 ──" && ls -l /app/app/utils/aixingguo.ts /app/public/aixingguo-session.js

# ── 安装依赖 ─────────────────────────────────────────────────
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=source /app ./
RUN yarn config set registry 'https://registry.npmmirror.com/' \
 && yarn install

# ── 构建 ─────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app ./
RUN yarn build

# ── 运行 ─────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN mkdir -p /app/app/mcp && chmod 777 /app/app/mcp \
 && cp /app/app/mcp/mcp_config.default.json /app/app/mcp/mcp_config.json

EXPOSE 3000
CMD ["node", "server.js"]
