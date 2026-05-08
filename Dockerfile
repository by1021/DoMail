# ============================================
# Stage 1: 构建前端
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# 先复制 package 文件利用 Docker 缓存
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# 复制前端源码并构建
COPY frontend/ ./
RUN npm run build

# ============================================
# Stage 2: 生产运行（后端 + 前端静态文件）
# ============================================
FROM node:20-alpine AS production

WORKDIR /app

# 安装后端依赖
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 复制后端源码
COPY backend/src/ ./src/

# 从前端构建阶段复制产物到 public 目录
COPY --from=frontend-builder /app/frontend/dist ./public/

# 创建数据目录（SQLite 数据库存储位置）
RUN mkdir -p /app/data

# 环境变量默认值
ENV NODE_ENV=production
ENV HTTP_PORT=3001
ENV SMTP_PORT=25
ENV SMTP_HOST=0.0.0.0
ENV DB_PATH=/app/data/data.db

# 暴露端口
EXPOSE 3001 25

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# 启动后端服务（同时服务前端静态文件）
CMD ["node", "src/index.js"]