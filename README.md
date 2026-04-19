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
- 用途：创建邮箱，支持自定义/随机前缀，以及主域名/随机子域名/自定义子域名

调用示例：

```bash
curl -X POST http://127.0.0.1:3001/api/mailboxes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"domain":"example.com","localPart":"test","random":false,"randomSubdomain":false}'
```

说明：

- `domain` 填已创建的主域名，例如 `example.com`
- 固定前缀：传 `localPart`，并保持 `random=false`
- 随机前缀：传 `random=true`
- 随机子域名：传 `randomSubdomain=true`
- 自定义子域名：传 `subdomain`，例如 `inbox`
- `randomSubdomain` 与 `subdomain` 二选一；传 `subdomain` 时优先使用自定义子域名

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

### 5. 查询最新一封邮件（列表格式）

- 方法：`GET`
- 路径：`/api/mailboxes/:address/messages?latest=1`
- 用途：只返回最新一封邮件，适合轮询或快速检查

调用示例：

```bash
curl "http://127.0.0.1:3001/api/mailboxes/test%40example.com/messages?latest=1" \
  -H "Authorization: Bearer <token>"
```

说明：

- 这是"查询邮件列表"接口的 `latest=1` 变体
- 返回的 `items` 最多只有一条记录

### 6. 查询最新邮件详情（完整格式）

- 方法：`GET`
- 路径：`/api/mailboxes/:address/latest-message`
- 用途：直接获取邮箱最新邮件的完整详情（包括附件列表），无需先查列表再查详情

调用示例：

```bash
curl "http://127.0.0.1:3001/api/mailboxes/test%40example.com/latest-message" \
  -H "Authorization: Bearer <token>"
```

说明：

- 一次请求即可获取最新邮件的完整信息
- 返回格式与"查询邮件详情"接口相同，包含 `attachments` 数组
- 如果邮箱不存在，返回 `404 MAILBOX_NOT_FOUND`
- 如果邮箱暂无邮件，返回 `404 MESSAGE_NOT_FOUND`
- 适合需要快速获取最新邮件完整内容的场景

### 7. 查询邮件详情

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

1. 后端由 PM2 作为常驻 Node.js 进程托管
2. 前端构建后由 Nginx 托管静态资源
3. Nginx 反向代理 `/api`
4. SMTP 由后端直接监听
5. 管理员账号、Session 密钥通过环境变量注入

### 1. 后端部署

```bash
cd /opt/domain-mail/backend
npm ci
cp .env.example .env
npm install -g pm2
pm2 start src/index.js --name domail-backend
```

推荐生产配置示例：

```env
NODE_ENV=production
HTTP_PORT=3001
SMTP_PORT=25
SMTP_HOST=0.0.0.0
MAIL_MX_HOST=mx.example.com
CORS_ORIGIN=https://mail.example.com
ADMIN_USERNAME=your-admin
ADMIN_PASSWORD=strong-password
SESSION_SECRET=random-long-secret
SESSION_MAX_AGE_MS=43200000
```

说明：

- `NODE_ENV=production` 下 Cookie 会启用 `Secure`
- 当前版本已对反向代理场景启用 `trust proxy` 兼容，适合放在 Nginx / Cloudflare 后面
- `MAIL_MX_HOST` 建议单独使用 `mx.example.com` 之类邮件主机名，不要与 Web 面板共用橙云代理域名
- `SMTP_PORT=25` 前需要确认系统权限、防火墙和云厂商端口策略
- `data.db` 默认在后端运行目录，因此 PM2 启动时当前目录必须是 `/opt/domain-mail/backend`
- 当前 Session 更适合单实例部署

推荐使用 PM2 托管后端，原因是：

- 支持后台运行，不依赖当前 SSH 会话
- 进程异常退出后可自动拉起
- 可直接管理日志、重启与开机自启
- 适合本项目同时监听 HTTP 与 SMTP 的常驻进程模型

推荐启动方式：

```bash
cd /opt/domain-mail/backend
pm2 start src/index.js --name domail-backend --update-env
```

如果是首次部署，建议先确认：

```bash
cd /opt/domain-mail/backend
NODE_ENV=production node src/index.js
```

确认 `.env`、端口和权限都正常后，再交给 PM2 托管。

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

1. 用 PM2 启动后端
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
- 如果启用 Cloudflare，Web 域名如 `mail.example.com` 可开橙云，但 MX / SMTP 主机名应保持灰云
- 如果启用 Cloudflare，源站 Nginx 需要识别 `CF-Connecting-IP`，当前示例配置已包含对应设置

## PM2 后台运行与开机自启

生产环境建议使用 **PM2** 管理后端，确保后台运行、异常拉起和开机自启。

**这一节有一个非常关键的前提：**
只要服务以生产模式运行（例如设置了 `NODE_ENV=production`），后端登录 Cookie 就会启用 `Secure`。
这意味着**管理后台必须通过 HTTPS 正式域名访问**，并且反向代理必须把 [`X-Forwarded-Proto`](deploy/nginx/domail.conf) 正确传给后端；否则就会出现：

- 登录接口返回成功
- 但随后请求 [`/api/auth/session`](backend/src/index.js:486) 或其他受保护接口时返回 `401`
- 前端表现为“请先登录管理账号”

如果你是下面这些情况之一，请不要直接照抄生产模式示例：

- 还在用 `http://服务器IP` 或 `http://域名`
- 还没配好 HTTPS 证书
- 还没让 Nginx 正确转发 [`X-Forwarded-Proto`](deploy/nginx/domail.conf)
- 还在直接访问 `http://127.0.0.1:3001` 验证登录页面

推荐场景：

- 项目部署目录：`/opt/domain-mail/backend`
- 后端目录中已存在 `.env`
- Node.js 已安装，并且当前用户可直接执行 `node`
- 前端由 Nginx 托管，并通过 HTTPS 正式域名访问
- Nginx 已按 [`deploy/nginx/domail.conf`](deploy/nginx/domail.conf) 反代 `/api`
- 尽量避免把服务长期部署在 `/root/...` 路径下

### 1. 安装 PM2

```bash
npm install -g pm2
pm2 -v
```

### 2. 使用 PM2 启动后端

推荐直接执行 [`backend/src/index.js`](backend/src/index.js:927)，避免额外的 `npm` 子进程层：

```bash
cd /opt/domain-mail/backend
pm2 start src/index.js --name domail-backend --update-env
```

如果你希望显式带上生产环境变量，也可以这样启动：

```bash
cd /opt/domain-mail/backend
NODE_ENV=production pm2 start src/index.js --name domail-backend --update-env
```

启动后常用命令：

```bash
pm2 status
pm2 logs domail-backend
pm2 restart domail-backend --update-env
pm2 stop domail-backend
pm2 delete domail-backend
```

说明：

- 必须先 `cd /opt/domain-mail/backend` 再启动，确保 `data.db` 仍落在后端目录
- 推荐进程名使用 `domail-backend`，方便排障和日志定位
- 修改 `.env` 后，使用 `pm2 restart domail-backend --update-env` 重新加载环境变量
- PM2 托管的是同一个 Node.js 进程，因此 Nginx 仍继续反代到 `127.0.0.1:3001`

### 3. 设置 PM2 开机自启

先保存当前进程列表：

```bash
pm2 save
```

然后生成并启用开机自启：

```bash
pm2 startup
```

PM2 会输出一条需要再执行一次的命令，通常类似：

```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root
```

把 PM2 输出的那条命令原样执行完成后，再执行一次：

```bash
pm2 save
```

这样服务器重启后，PM2 会自动恢复 `domail-backend` 进程。

### 4. 部署后先做这 4 个确认

1. 确认 PM2 实际读到了生产环境变量
   例如用 `pm2 env domail-backend`、`pm2 show domail-backend` 或 `pm2 logs domail-backend` 检查当前启动命令、工作目录与报错信息。

2. 确认浏览器访问的是 **HTTPS 正式域名**，不是：
   - `http://服务器IP`
   - `http://域名`
   - `http://127.0.0.1:3001`

3. 确认反向代理把 HTTPS 信息传给了后端
   参考 [`deploy/nginx/domail.conf`](deploy/nginx/domail.conf) 中 `/api/` 的这些头：
   - `X-Forwarded-Proto`
   - `X-Forwarded-Host`
   - `X-Forwarded-Port`

4. 确认前端生产环境仍通过同域 `/api` 访问后端，而不是写死到 `127.0.0.1:3001`

补充建议：

- PM2 启动前所在目录必须固定到后端目录，否则 SQLite 的 `data.db` 可能生成到错误位置
- 若放在 Nginx / Cloudflare 之后，后端需运行在 `NODE_ENV=production`
- **一旦设置了 `NODE_ENV=production`，就必须确保浏览器是通过 HTTPS 域名访问站点**
- 如果暂时还在用 HTTP 调试登录，不要把后端以生产模式跑在最终访问链路上
- 若登录后立刻掉线，优先检查代理头、HTTPS、Cookie `Secure`、以及反向代理下的 `trust proxy` 配置
- 如果你发现“手动执行 [`node src/index.js`](backend/src/index.js:927) 可以登录，但 PM2 托管后不行”，最常见原因就是：PM2 启动时没有带上预期环境变量，或启动目录不在 `/opt/domain-mail/backend`

## 常见问题排查

### 1. 页面能打开，但接口 401

优先检查：

- 是否已登录
- 浏览器是否携带 Cookie
- `CORS_ORIGIN` 是否正确
- 是否通过同域 `/api` 访问后端
- Nginx 是否正确传递了 `X-Forwarded-Proto`
- 如果启用了 Cloudflare，是否已在 Nginx 中识别 `CF-Connecting-IP`
- 后端是否运行在 `NODE_ENV=production` 且已启用反向代理兼容配置
- 当前访问地址是否真的是 **HTTPS 正式域名**
- 是否误用了 `http://IP:3001`、`http://域名` 或其他非 HTTPS 地址访问管理后台

常见现象是：登录请求返回成功，但随后调用 [`/api/auth/session`](backend/src/index.js:486) 或其他受保护接口时立刻变成 `401`。这通常说明浏览器没有正确保存或回传 [`domail.sid`](backend/src/index.js:262)。

如果后端运行在生产模式，[`createSessionMiddleware()`](backend/src/index.js:258) 会把 Cookie 设为 `secure: true`，并且 [`createApp()`](backend/src/index.js:421) 会启用 `trust proxy`。
因此只要反向代理没有把 HTTPS 信息正确传进来，或者浏览器根本不是通过 HTTPS 域名访问，登录后就会表现成“刚登录就掉线”。

一个高频误区是：

- 手动在 shell 里启动后端时，没有设置 `NODE_ENV=production`，所以登录正常
- 换成 [`systemd`](README.md:476) 后，服务文件里加了 `Environment=NODE_ENV=production`
- 这时 Cookie 改成了 `Secure`
- 如果你访问的仍然不是 HTTPS 正式域名，就会看到“请先登录管理账号”

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