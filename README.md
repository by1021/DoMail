# DoMail

DoMail 是一个用于**自建域名邮件收件测试与管理**的前后端分离项目。  
它提供：

- 管理员登录
- 域名管理
- 邮箱管理
- SMTP 收件
- 邮件解析与 SQLite 存储
- Web 页面查看邮件
- Nginx 生产部署示例

适合用于：

- 自建域名收件链路验证
- 测试邮箱 / 回执邮箱搭建
- 开发、联调、验收环境邮件接收测试

## 项目结构

```text
backend/   Node.js + Express + SMTP + SQLite
frontend/  React + Vite
deploy/    Nginx 部署示例
```

关键文件：

- 后端入口：`backend/src/index.js`
- 前端配置：`frontend/vite.config.js`
- 后端环境变量示例：`backend/.env.example`
- Nginx 示例配置：`deploy/nginx/domail.conf`
- Nginx 详细说明：`deploy/nginx/README.md`

## 环境要求

- Node.js 20+
- npm 10+
- Linux 服务器（生产环境推荐 Ubuntu / Debian）
- 可用的 SMTP 监听端口

默认端口：

- 后端 HTTP：`3001`
- SMTP：`2525`
- 前端开发：`5173`

## 开发部署

### 1. 安装依赖

后端：

```bash
cd backend
npm ci
```

前端：

```bash
cd frontend
npm ci
```

### 2. 配置后端环境变量

复制 [`backend/.env.example`](backend/.env.example) 为 `.env`：

```bash
cd backend
cp .env.example .env
```

Windows 可手动复制。

最小开发配置示例：

```env
HTTP_PORT=3001
SMTP_PORT=2525
SMTP_HOST=0.0.0.0
MAIL_MX_HOST=mx.example.com
CORS_ORIGIN=http://127.0.0.1:5173
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-password
SESSION_SECRET=change-this-session-secret
SESSION_MAX_AGE_MS=43200000
```

注意：

- `ADMIN_USERNAME`、`ADMIN_PASSWORD`、`SESSION_SECRET` 缺失时后端不会启动
- `MAIL_MX_HOST` 只是页面提示，不会自动配置 DNS
- 开发环境下 `CORS_ORIGIN` 建议写 `http://127.0.0.1:5173`

### 3. 启动开发环境

启动后端：

```bash
cd backend
npm run dev
```

或：

```bash
cd backend
npm start
```

启动前端：

```bash
cd frontend
npm run dev
```

### 4. 开发环境默认行为

- [`frontend/vite.config.js`](frontend/vite.config.js) 会把 `/api` 代理到 `http://127.0.0.1:3001`
- 前端开发地址默认是 `http://127.0.0.1:5173`
- 前端通过 `/api` 访问后端
- 登录后通过 Cookie / Session 保持会话

## 开发测试

建议按以下顺序验证：

1. 启动后端和前端
2. 打开管理页面并登录
3. 访问 `GET /api/health`
4. 创建域名
5. 创建邮箱
6. 向 SMTP 端口发送测试邮件
7. 在页面查看邮件列表和详情

本地最小成功链路：

- 后端已启动
- SMTP 正在监听
- 域名已创建
- 邮箱已创建
- 测试邮件已投递到正确地址
- 邮件已写入 `data.db`
- 页面能查到邮件

常用检查项：

- 后端健康检查：`http://127.0.0.1:3001/api/health`
- 前端开发地址：`http://127.0.0.1:5173`
- SMTP 默认端口：`2525`

如果 SMTP 在监听但收不到邮件，优先检查：

- 域名和邮箱是否先创建
- 测试邮件地址是否正确
- `SMTP_PORT` 是否真实监听
- `data.db` 是否已生成
- 页面是否刷新到最新邮件

## API 接口说明（仅前端说明页提到的）

前端“API 说明”页展示的接口定义来源于 [`API_ENDPOINTS`](frontend/src/app-config.jsx:77)，对应页面渲染逻辑位于 [`App()`](frontend/src/App.jsx:986)。
本节**只记录前端说明页明确展示给用户的接口**，不展开 [`loginAdmin()`](frontend/src/api.js:9)、[`getAdminSession()`](frontend/src/api.js:19)、[`createApiToken()`](frontend/src/api.js:97) 等后台管理或页面内部使用接口。

### 认证方式

前端说明页要求使用 Bearer Token，请求头格式如下：

```http
Authorization: Bearer <token>
```

Token 可在管理后台的 API 页面创建；页面中“请求头格式”和 Token 管理逻辑可参考 [`App()`](frontend/src/App.jsx:1018)。

### 1. 查询邮箱列表

- 方法：`GET`
- 路径：`/api/mailboxes`
- 用途：获取所有邮箱列表，返回邮箱地址、域名、邮件数等信息

调用示例：

```bash
curl http://127.0.0.1:3001/api/mailboxes \
  -H "Authorization: Bearer <token>"
```

说明：

- 返回结果中的 `items` 数组包含邮箱记录
- 可从结果中提取邮箱地址 `address`
- 后续查询邮件列表时，需要把邮箱地址做 URL 编码后放入路径参数

### 2. 创建邮箱

- 方法：`POST`
- 路径：`/api/mailboxes`
- 用途：创建邮箱，支持固定前缀或随机前缀

调用示例：

```bash
curl -X POST http://127.0.0.1:3001/api/mailboxes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"domain":"example.com","localPart":"test","random":false}'
```

说明：

- `domain` 直接填写已创建的域名字符串
- 固定前缀时传 `localPart`
- 随机邮箱可传 `random=true`

### 3. 删除邮箱

- 方法：`DELETE`
- 路径：`/api/mailboxes/:address`
- 用途：删除指定邮箱

调用示例：

```bash
curl -X DELETE "http://127.0.0.1:3001/api/mailboxes/test%40example.com" \
  -H "Authorization: Bearer <token>"
```

说明：

- 路径参数 `:address` 需要使用完整邮箱地址
- 调用前必须先做 URL 编码，例如 `test@example.com` 编码为 `test%40example.com`

### 4. 查询邮件列表

- 方法：`GET`
- 路径：`/api/mailboxes/:address/messages`
- 用途：按邮箱地址获取完整邮件列表

调用示例：

```bash
curl "http://127.0.0.1:3001/api/mailboxes/test%40example.com/messages" \
  -H "Authorization: Bearer <token>"
```

说明：

- `:address` 同样需要 URL 编码
- 返回结果中的 `items` 数组包含邮件列表
- 可从结果中提取 `messageId`，继续查询详情

### 5. 查询最新一封邮件

- 方法：`GET`
- 路径：`/api/mailboxes/:address/messages?latest=1`
- 用途：只返回最新一封邮件，适合轮询或快速检查

调用示例：

```bash
curl "http://127.0.0.1:3001/api/mailboxes/test%40example.com/messages?latest=1" \
  -H "Authorization: Bearer <token>"
```

说明：

- 这是“查询邮件列表”接口的 `latest=1` 变体
- 返回的 `items` 最多只有一条记录

### 6. 查询邮件详情

- 方法：`GET`
- 路径：`/api/messages/:messageId`
- 用途：根据邮件 ID 获取单封邮件详情

调用示例：

```bash
curl "http://127.0.0.1:3001/api/messages/<messageId>" \
  -H "Authorization: Bearer <token>"
```

说明：

- `messageId` 一般来自“查询邮件列表”接口返回结果
- 适合读取完整正文、头信息与附件元数据

### 调用顺序建议

建议按下面顺序使用这些接口：

1. 先在页面创建 API Token
2. 调用 `GET /api/mailboxes` 获取已有邮箱
3. 如无目标邮箱，调用 `POST /api/mailboxes` 创建
4. 调用 `GET /api/mailboxes/:address/messages` 查询邮件
5. 如只关心最新结果，改用 `GET /api/mailboxes/:address/messages?latest=1`
6. 从邮件列表中取出 `messageId` 后，调用 `GET /api/messages/:messageId` 查看详情

说明：

- 开发环境下前端通常通过 `/api` 代理访问后端，见 [`frontend/vite.config.js`](frontend/vite.config.js)
- 如果你直接在终端使用 [`curl`](README.md)，本地开发可写完整地址 `http://127.0.0.1:3001/api/...`
- 生产环境建议通过 Nginx 暴露同域 `/api/*`

## 生产部署

推荐目录：

```text
/opt/domain-mail
├─ backend
├─ frontend
│  └─ dist
└─ deploy
   └─ nginx
```

生产部署建议：

1. 后端作为常驻 Node.js 进程运行
2. 前端构建后由 Nginx 托管静态资源
3. Nginx 反向代理 `/api`
4. SMTP 由后端直接监听
5. 管理员账号、Session 密钥通过环境变量注入

### 1. 后端部署

```bash
cd /opt/domain-mail/backend
npm ci
cp .env.example .env
npm start
```

推荐生产配置示例：

```env
NODE_ENV=production
HTTP_PORT=3001
SMTP_PORT=25
SMTP_HOST=0.0.0.0
MAIL_MX_HOST=mail.example.com
CORS_ORIGIN=https://mail.example.com
ADMIN_USERNAME=your-admin
ADMIN_PASSWORD=strong-password
SESSION_SECRET=random-long-secret
SESSION_MAX_AGE_MS=43200000
```

说明：

- `NODE_ENV=production` 下 Cookie 行为更严格
- `SMTP_PORT=25` 前需要确认系统权限、防火墙和云厂商端口策略
- `data.db` 默认在后端运行目录
- 当前 Session 更适合单实例部署

### 2. 前端部署

```bash
cd /opt/domain-mail/frontend
npm ci
```

创建生产环境变量：

```env
VITE_API_BASE_URL=/api
```

构建：

```bash
npm run build
```

构建产物默认输出到：

```text
frontend/dist
```

建议：

- 生产环境继续使用 `/api`
- 不要在前端写死 `127.0.0.1:3001`
- 让浏览器访问当前域名下的 `/api/*`，再由 Nginx 转发给后端

## 生产测试

推荐上线验证顺序：

1. 启动后端
2. 本机访问 `http://127.0.0.1:3001/api/health`
3. 构建前端
4. 配置并重载 Nginx
5. 打开正式域名首页
6. 登录后台
7. 创建域名和邮箱
8. 发送一封测试邮件
9. 确认页面可看到邮件内容

如果做公网真实收件，还需要自行确认：

- 域名 MX 记录
- DNS 已生效
- 防火墙已放行 SMTP 端口
- 云厂商未限制目标端口
- 收件主机可被外部访问

## Nginx 反向代理

仓库已提供示例配置：

- [`deploy/nginx/domail.conf`](deploy/nginx/domail.conf)
- [`deploy/nginx/README.md`](deploy/nginx/README.md)

示例配置的核心逻辑：

- `80` 端口处理 HTTP 和证书校验
- 其余 HTTP 请求跳转到 HTTPS
- `443` 端口提供正式站点
- `root` 指向前端构建目录
- `/api/` 反代到 `http://127.0.0.1:3001/api/`
- `/` 使用 SPA 回退到 `index.html`

核心配置示意：

```nginx
server {
    listen 80;
    server_name mail.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name mail.example.com;

    root /opt/domain-mail/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
    }

    location / {
        try_files $uri /index.html;
    }
}
```

部署时重点检查：

- `server_name` 已替换成真实域名
- 证书路径已替换成真实文件
- `root` 指向真实的 `frontend/dist`
- 不要把静态目录放到 `/root/...`
- `sudo nginx -t` 校验通过
- `/api/health` 可通过正式域名访问

## 开机自启动

生产环境建议使用 `systemd` 管理后端，确保开机自启和异常拉起。

### `systemd` 示例

文件示例：`/etc/systemd/system/domail-backend.service`

```ini
[Unit]
Description=DoMail Backend
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/domain-mail/backend
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
User=www-data

[Install]
WantedBy=multi-user.target
```

启用方式：

```bash
sudo systemctl daemon-reload
sudo systemctl enable domail-backend
sudo systemctl start domail-backend
sudo systemctl status domail-backend
```

说明：

- `WorkingDirectory` 改成你的后端目录
- `User` 改成实际运行用户
- 如需加载 `.env`，可额外使用 `EnvironmentFile=` 或在启动方式中自行注入环境变量
- Nginx 也建议设置为系统服务并保持开机自启

## 常见问题排查

### 1. 页面能打开，但接口 401

优先检查：

- 是否已登录
- 浏览器是否携带 Cookie
- `CORS_ORIGIN` 是否正确
- 是否通过同域 `/api` 访问后端

### 2. 页面跨域报错

优先检查：

- 后端 `.env` 的 `CORS_ORIGIN`
- 前端是否仍请求了错误域名或端口
- 生产环境是否通过 Nginx 统一成同域

### 3. 首页返回 403

优先检查：

- Nginx `root` 是否正确
- 目录是否放在 `/root` 等受限路径
- Nginx 用户是否有读取权限
- `index.html` 是否真实存在

### 4. SMTP 能监听，但公网收不到邮件

优先检查：

- MX 是否正确
- 防火墙是否放行
- 端口是否被云厂商限制
- 邮件是否发往已创建的邮箱地址

## 补充说明

- 更详细的 Nginx 部署排障请查看 [`deploy/nginx/README.md`](deploy/nginx/README.md)
- 示例配置请查看 [`deploy/nginx/domail.conf`](deploy/nginx/domail.conf)