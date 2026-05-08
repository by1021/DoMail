# DoMail Docker 部署指南

## 架构说明

单容器部署方案：
- 前端（React）在构建阶段编译为静态文件
- 后端（Express + SMTP）在生产模式下直接服务前端静态文件
- SQLite 数据库通过 Docker Volume 持久化

```
┌─────────────────────────────────┐
│        Docker Container         │
│                                 │
│  ┌──────────────────────────┐   │
│  │   Express (port 3001)    │   │
│  │   ├── /api/*  → API 路由 │   │
│  │   └── /*     → 前端静态  │   │
│  └──────────────────────────┘   │
│                                 │
│  ┌──────────────────────────┐   │
│  │   SMTP (port 2525)       │   │
│  │   接收邮件               │   │
│  └──────────────────────────┘   │
│                                 │
│  ┌──────────────────────────┐   │
│  │   SQLite → /app/data/    │   │
│  └──────────────────────────┘   │
└─────────────────────────────────┘
```

## 快速启动

### 方式一：docker-compose（推荐）

1. **编辑配置**

   修改项目根目录的 `docker-compose.yml`，至少修改以下环境变量：

   ```yaml
   - ADMIN_USERNAME=your-admin-name
   - ADMIN_PASSWORD=your-strong-password
   - SESSION_SECRET=your-random-secret-string
   - CORS_ORIGIN=https://mail.yourdomain.com
   - MAIL_MX_HOST=mx.yourdomain.com
   ```

2. **构建并启动**

   ```bash
   docker-compose up -d --build
   ```

3. **访问**

   - 前端界面：http://localhost:3001
   - API 健康检查：http://localhost:3001/api/health

4. **查看日志**

   ```bash
   docker-compose logs -f domail
   ```

5. **停止**

   ```bash
   docker-compose down
   ```

### 方式二：纯 Docker 命令

1. **构建镜像**

   ```bash
   docker build -t domail .
   ```

2. **运行容器**

   ```bash
   docker run -d \
     --name domail \
     --restart unless-stopped \
     -p 3001:3001 \
     -p 25:25 \
     -v domail-data:/app/data \
     -e NODE_ENV=production \
     -e SMTP_PORT=25 \
     -e ADMIN_USERNAME=admin \
     -e ADMIN_PASSWORD=your-strong-password \
     -e SESSION_SECRET=your-random-secret \
     -e CORS_ORIGIN=http://localhost:3001 \
     -e MAIL_MX_HOST=mx.yourdomain.com \
     domail
   ```

## 环境变量说明

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `NODE_ENV` | 否 | `production` | 运行环境 |
| `HTTP_PORT` | 否 | `3001` | HTTP API 端口 |
| `SMTP_PORT` | 否 | `25` | SMTP 接收端口（生产标准端口） |
| `SMTP_HOST` | 否 | `0.0.0.0` | SMTP 监听地址 |
| `DB_PATH` | 否 | `/app/data/data.db` | SQLite 数据库文件路径 |
| `ADMIN_USERNAME` | ✅ | - | 管理员用户名 |
| `ADMIN_PASSWORD` | ✅ | - | 管理员密码 |
| `SESSION_SECRET` | ✅ | - | Session 加密密钥 |
| `SESSION_MAX_AGE_MS` | 否 | `43200000` | Session 过期时间（ms, 默认12小时） |
| `CORS_ORIGIN` | 否 | 允许所有 | 允许的前端域名（多个用逗号分隔） |
| `MAIL_MX_HOST` | 否 | - | MX 主机名（DNS 配置提示用） |

## 生产部署建议

### 使用反向代理（Nginx/Caddy）

如果使用外部反向代理，建议：

```nginx
server {
    listen 80;
    server_name mail.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### SMTP 端口

- 容器内默认使用标准端口 `25`
- docker-compose 已配置 `25:25` 映射
- 确保服务器防火墙和云安全组已放行 25 端口

```yaml
ports:
  - "25:25"      # 标准 SMTP
  - "3001:3001"  # HTTP
```

### 数据备份

SQLite 数据库存储在 Docker Volume `domail-data` 中：

```bash
# 查看 volume 位置
docker volume inspect domail-data

# 备份数据库
docker cp domail:/app/data ./backup/
```

### 生成安全的 SESSION_SECRET

```bash
openssl rand -hex 32
```

## 常见问题

**Q: 容器启动后访问页面空白？**

检查构建时前端是否正确编译，查看容器日志：
```bash
docker logs domail
```
应能看到 `[static] Serving frontend from /app/public`

**Q: SMTP 无法接收邮件？**

1. 确保防火墙放行了 SMTP 端口（25 或 2525）
2. 确保 DNS MX 记录正确指向你的服务器
3. 检查是否需要在云服务器安全组中放行端口

**Q: 如何更新？**

```bash
# 拉取最新代码后
docker-compose up -d --build
```
数据通过 Volume 持久化，重建容器不会丢失。