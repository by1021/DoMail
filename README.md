# DoMail

DoMail 是一个用于**自建域名邮件收件测试与管理**的前后端分离项目。

它聚焦“**收件链路可验证**”而不是完整邮件服务商能力：

1. 创建域名
2. 创建邮箱
3. 后端通过 SMTP 接收邮件
4. 邮件解析后写入 SQLite
5. 前端或 HTTP API 查看邮件列表与详情

## 项目结构

```text
backend/   Node.js + Express + SMTP + SQLite
frontend/  React + Vite + Ant Design
deploy/    Nginx 示例配置
```

关键入口：

- 后端入口：`backend/src/index.js`
- 数据层：`backend/src/db.js`
- SMTP 辅助：`backend/src/smtp-utils.js`
- 前端主界面：`frontend/src/App.jsx`
- 前端 API：`frontend/src/api.js`
- 环境变量示例：`backend/.env.example`
- Nginx 示例：`deploy/nginx/domail.conf`

## 功能概览

- 管理员登录（Cookie / Session）
- 域名管理
- 邮箱管理
- 邮件列表与详情查看
- API Token 管理
- SMTP 本地收件验证
- SQLite 持久化存储
- Nginx 反向代理部署示例

## 技术栈

### 后端

- Node.js
- Express
- `smtp-server`
- `mailparser`
- `zod`
- SQLite（`node:sqlite`）

### 前端

- React
- Vite
- Ant Design
- Axios

---

## 快速开始

## 1. 安装依赖

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

## 2. 配置环境变量

复制 `backend/.env.example` 为 `backend/.env`。

至少需要配置：

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=请改成强密码
SESSION_SECRET=请改成随机长字符串
HTTP_PORT=3001
SMTP_PORT=2525
SMTP_HOST=0.0.0.0
```

说明：

- `ADMIN_USERNAME` / `ADMIN_PASSWORD`：后台管理员账号
- `SESSION_SECRET`：Session 签名密钥
- `HTTP_PORT`：HTTP API 端口，默认 `3001`
- `SMTP_PORT`：SMTP 收件端口，默认 `2525`
- `SMTP_HOST`：SMTP 监听地址，默认 `0.0.0.0`

如果缺少管理员配置，后端会拒绝启动。

## 3. 启动开发环境

启动后端：

```bash
cd backend
npm start
```

启动前端：

```bash
cd frontend
npm run dev
```

开发环境默认行为：

- 前端运行在 Vite 开发服务器
- 前端请求相对路径 `/api`
- `frontend/vite.config.js` 会把 `/api` 代理到 `http://127.0.0.1:3001`

## 4. 基础验证顺序

建议按这个顺序人工验证：

1. 访问 `GET /api/health`
2. 登录后台
3. 创建域名
4. 创建邮箱
5. 向 SMTP 端口投递测试邮件
6. 查看邮件列表
7. 查看邮件详情

---

## 收件链路说明

系统的核心链路如下：

1. 后端启动 HTTP API 与 SMTP 服务
2. 先创建域名
3. 再创建该域名下的邮箱
4. 外部程序向该邮箱投递邮件
5. 后端解析邮件并写入 SQLite
6. 前端或 API 查看邮件内容

注意：

- 域名和邮箱必须先创建
- 域名需满足最小 MX 收件条件后才会被视为可收件
- 数据库文件默认位于后端运行目录下的 `data.db`

---

## 管理后台说明

当前版本为**单管理员账号**模型：

- 账号密码来自环境变量
- 登录成功后由 Cookie / Session 保持会话
- 未登录时，除健康检查与认证接口外，其余管理接口默认返回 `401`

### API Token

管理员可在前端 `API` 页面创建 Token。

Token 适用于以下收件相关接口：

- `GET /api/mailboxes`
- `POST /api/mailboxes`
- `DELETE /api/mailboxes/:address`
- `PATCH /api/mailboxes/:address/retention`
- `GET /api/mailboxes/:address/messages`
- `GET /api/messages/:id`

其他管理接口仍要求管理员 Session。

---

## 开发说明

### 前端

- 主界面入口：`frontend/src/App.jsx`
- 认证入口：`frontend/src/AuthApp.jsx`
- 公共配置：`frontend/src/app-config.js`
- 公共视图 helper：`frontend/src/app-view-helpers.js`

前端默认采用：

- 页面级状态集中管理
- 组件分区渲染
- 相对路径 `/api`
- `withCredentials: true` 发送 Cookie

### 后端

- 单文件入口路由：`backend/src/index.js`
- SQLite 查询与映射：`backend/src/db.js`
- SMTP 域名校验：`backend/src/smtp-utils.js`

后端当前设计特点：

- 适合单实例部署
- Session 使用默认内存存储
- 数据结构通过轻量迁移兼容旧 SQLite 数据
- 不包含多用户、RBAC、注册、找回密码等复杂鉴权体系

---

## 生产说明

生产环境建议：

1. 前端先构建为静态资源
2. 使用 Nginx 托管前端并反向代理 `/api`
3. 后端以常驻进程方式运行
4. SMTP 端口按实际场景开放
5. 管理员账号与密钥通过环境变量注入

### 生产环境变量建议

```env
NODE_ENV=production
ADMIN_USERNAME=your-admin
ADMIN_PASSWORD=strong-password
SESSION_SECRET=random-long-secret
HTTP_PORT=3001
SMTP_PORT=25
SMTP_HOST=0.0.0.0
CORS_ORIGIN=https://your-domain.example
MAIL_MX_HOST=mail.your-domain.example
```

说明：

- `NODE_ENV=production` 会使 Session Cookie 使用 `secure`
- `CORS_ORIGIN` 建议显式指定
- `MAIL_MX_HOST` 用于生成和校验 MX 指引时的目标主机

---

## 部署说明

## 1. 推荐部署结构

推荐目录示例：

```bash
/opt/domain-mail
```

可拆分为：

```text
/opt/domain-mail/backend
/opt/domain-mail/frontend
```

## 2. 典型部署方式

- 后端：常驻运行 Node 服务
- 前端：构建后交给 Nginx 提供静态资源
- Nginx：反向代理 `/api` 到后端
- SMTP：由后端直接监听

## 3. Nginx

仓库内提供示例配置：

- `deploy/nginx/domail.conf`
- `deploy/nginx/README.md`

典型职责：

- 提供前端静态资源
- 代理 `/api`
- 转发必要请求头
- 为 Web 界面提供统一入口

## 4. SMTP / MX

如果只是本地或内网验证，可直接使用 `2525`。

如果要做公网验证，需要额外处理：

- 公网 IP
- 防火墙
- 云厂商 25 端口策略
- 域名 MX 记录
- 反向解析、SPF、DMARC、DKIM 等邮件生态配置

DoMail 当前主要解决的是**收件测试链路**，不是完整外发邮件平台。

---

## API 概览

## 认证接口

### `POST /api/auth/login`

管理员登录。

请求体：

```json
{
  "username": "admin",
  "password": "your-password"
}
```

成功返回：

```json
{
  "ok": true,
  "item": {
    "username": "admin"
  }
}
```

### `GET /api/auth/session`

查询当前登录态。

### `POST /api/auth/logout`

退出登录。

---

## 基础接口

### `GET /api/health`

健康检查。

返回内容包含：

- 服务标识
- 域名数量
- 邮箱数量
- 邮件数量
- 时间戳

### `GET /api/domains`

查询域名列表。

### `POST /api/domains`

创建域名。

最小请求示例：

```json
{
  "domain": "example.com",
  "note": "test domain"
}
```

### `GET /api/domains/:id`

查询域名详情。

### `POST /api/domains/:id/detect-dns`

检测域名 DNS / MX 状态。

---

## 邮箱接口

### `GET /api/mailboxes`

查询邮箱列表。

### `POST /api/mailboxes`

创建邮箱。

示例：

```json
{
  "domain": "example.com",
  "localPart": "test",
  "random": false
}
```

或：

```json
{
  "domain": "example.com",
  "random": true
}
```

### `DELETE /api/mailboxes/:address`

删除邮箱。

### `PATCH /api/mailboxes/:address/retention`

更新自动清理策略。

示例：

```json
{
  "retentionValue": 24,
  "retentionUnit": "hour"
}
```

---

## 邮件接口

### `GET /api/mailboxes/:address/messages`

查看某个邮箱的邮件列表。

支持：

- `?latest=1`：只返回最新一封

### `GET /api/messages/:id`

查看单封邮件详情。

### `PATCH /api/messages/:id/read`

标记邮件为已读。

### `DELETE /api/messages/:id`

删除邮件。

---

## Token 接口

### `GET /api/tokens`

查询 Token 列表。

### `POST /api/tokens`

创建 Token。

### `DELETE /api/tokens/:id`

删除 Token。

---

## 已知边界

- 当前仅支持单管理员账号
- Session 为默认内存存储，不适合多实例共享
- 默认只覆盖“收件测试和查看”核心链路
- 不包含邮件外发服务能力
- 不包含附件下载接口
- 不包含多角色权限和用户系统

---

## 维护建议

如果后续继续扩展，优先考虑：

- 将更多页面逻辑继续从 `frontend/src/App.jsx` 拆出
- 将后端路由按模块拆分
- 为生产部署替换外部 Session Store
- 增加更系统的自动化测试与前端页面验证