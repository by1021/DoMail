# DoMail

一个用于**自建域名邮件收件测试与管理**的前后端分离项目。

它的核心目标不是做完整邮件服务商，而是提供一条可验证的收件链路：

- 在系统中创建域名与邮箱
- 后端通过 SMTP 监听收件
- 接收到的邮件被解析并写入 SQLite
- 通过 HTTP API 和前端页面查看邮件内容

相关实现入口可参考：

- 后端启动与 SMTP 收件逻辑：`backend/src/index.js`
- SQLite 数据存储：`backend/src/db.js`
- 前端 API 封装：`frontend/src/api.js`
- 默认环境变量示例：`backend/.env.example`
- SMTP 收件辅助逻辑：`backend/src/smtp-utils.js`

---

## 1. 项目特性

- 前后端分离
- 后端同时提供 HTTP API 与 SMTP 收件服务
- 支持域名、邮箱、邮件列表、邮件详情管理
- 使用 SQLite 落库存储邮件数据
- 支持本地 `2525` 端口程序级收件验证
- 支持 Ubuntu VPS 一键部署
- 支持后续切换到公网 `25` 端口进行 MX 验证

---

## 2. 技术栈

### 后端

见 `backend/package.json`：

- Node.js
- Express
- `smtp-server`
- `mailparser`
- `zod`
- SQLite（实际存储逻辑在 `backend/src/db.js`）

### 前端

见 `frontend/package.json`：

- React 19
- Vite
- Ant Design
- Axios

---

## 3. 目录结构

```text
.
├─ backend/
│  ├─ src/
│  │  ├─ index.js
│  │  └─ db.js
│  ├─ .env.example
│  └─ package.json
├─ frontend/
│  ├─ src/
│  │  ├─ api.js
│  │  ├─ App.jsx
│  │  └─ components/
│  └─ package.json
└─ README.md
```

---

## 4. 默认端口与环境变量

默认示例见 `backend/.env.example`：

```env
HTTP_PORT=3001
SMTP_PORT=2525
SMTP_HOST=0.0.0.0
CORS_ORIGIN=https://mail.example.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-password
SESSION_SECRET=change-this-session-secret
SESSION_MAX_AGE_MS=43200000
```

当前项目默认行为：

- HTTP API 默认监听 `3001`
- SMTP 默认监听 `2525`
- SMTP 默认监听地址 `0.0.0.0`
- 管理后台登录账号来自 `ADMIN_USERNAME` / `ADMIN_PASSWORD`
- 管理会话通过 `SESSION_SECRET` 签名，默认有效期 12 小时（`43200000ms`）

对应实现可见 `backend/src/index.js` 中的启动逻辑。

前端默认 API 地址见 [`frontend/src/api.js`](frontend/src/api.js)：

- 默认使用相对路径 `/api`
- 生产环境或特殊部署场景可通过 `VITE_API_BASE_URL` 覆盖

---

## 5. 收件链路工作原理

当前项目的核心链路如下：

1. 启动后端 HTTP API 和 SMTP 服务
2. 在系统中先创建域名
3. 再创建该域名下的邮箱
4. 外部程序通过 SMTP 向该邮箱地址投递邮件
5. 后端解析原始邮件内容
6. 邮件写入 SQLite
7. 前端或接口读取邮件列表与详情

### 关键约束

SMTP 收件前，必须先创建：

- 域名，例如 `example.com`
- 邮箱，例如 `test@example.com`

原因：

- 在 `backend/src/index.js` 的 SMTP `onRcptTo` 校验中，会检查收件域名是否存在且启用
- 邮件落库时会按收件地址匹配系统中已有邮箱
- 如果未提前创建域名或邮箱，邮件可能被拒绝，或无法进入预期邮箱

---

## 6. 本地开发启动

### 6.1 安装依赖

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

### 6.2 配置后端环境变量

复制环境变量示例文件：

```bash
cd backend
cp .env.example .env
```

Windows 可手动复制 `backend/.env.example` 为 `backend/.env`。

至少需要补齐以下管理员登录配置：

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=请改成强密码
SESSION_SECRET=请改成随机长字符串
```

如果缺少这些字段，后端会拒绝启动，避免在未鉴权状态下暴露管理接口。

### 6.3 启动后端

```bash
cd backend
npm start
```

启动成功后，预期看到类似输出：

```text
HTTP API listening on port 3001
SMTP receiver listening on 0.0.0.0:2525
```

### 6.4 启动前端开发服务器

```bash
cd frontend
npm run dev
```

前端会通过 `frontend/src/api.js` 中的默认配置请求 `http://localhost:3001`。

启动前端后，页面会先进入管理员登录页；只有登录成功后才会加载域名、邮箱和邮件管理数据。

---

## 7. 管理员登录与会话

### 7.1 登录方式

当前版本只支持**单管理员账号**：

- 用户名：来自 `ADMIN_USERNAME`
- 密码：来自 `ADMIN_PASSWORD`
- 登录态：通过 Cookie + Session 保存
- 会话查询接口：[`GET /api/auth/session`](README.md:226)
- 退出接口：[`POST /api/auth/logout`](README.md:234)

### 7.2 认证接口

查询当前登录态：

```bash
curl -i http://127.0.0.1:3001/api/auth/session
```

管理员登录：

```bash
curl -i -X POST http://127.0.0.1:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
```

退出登录：

```bash
curl -i -X POST http://127.0.0.1:3001/api/auth/logout
```

### 7.3 受保护接口

除 [`GET /api/health`](README.md:238) 与认证接口外，其余管理接口默认都要求已登录。

如果未登录直接访问，例如：

```bash
curl -i http://127.0.0.1:3001/api/domains
```

预期会得到 `401`，表示需要先登录管理员账号。

### 7.4 API Token（Bearer Token）

当前版本支持由管理员在后台创建 **API Token**，供程序只读访问邮件接口。

#### Token 用途

Token 只允许访问以下两个只读接口：

- `GET /api/mailboxes/:mailboxId/messages`
- `GET /api/messages/:messageId`

其他接口（如域名管理、邮箱创建、删除邮件等）仍然只允许管理员 Session 访问。

#### Token 创建方式

1. 使用管理员账号登录后台
2. 打开前端侧边栏中的 [`API`](frontend/src/App.jsx) 页面
3. 输入名称并创建 Token
4. 系统只会在创建成功当次返回完整 Token，请立即复制保存

数据库中不会保存明文 Token，只保存哈希与前缀信息。

#### Bearer 请求头格式

```text
Authorization: Bearer <token>
```

#### `mailboxId` 是什么？怎么获取？

`mailboxId` 不是邮箱地址，也不是域名，而是系统为每个邮箱生成的唯一 ID。

例如你创建了邮箱 `test@example.com`，真正用于调用以下接口的，是这个邮箱对应的 `id` 字段：

- `GET /api/mailboxes/:mailboxId/messages`
- `GET /api/mailboxes/:mailboxId/messages?latest=1`

获取方式如下：

1. 先调用 [`GET /api/mailboxes`](README.md:348)
2. 在返回结果中找到目标邮箱，例如 `test@example.com`
3. 读取该邮箱对象里的 `id`
4. 把这个 `id` 填到 `<mailboxId>` 位置

也就是说：

- 邮箱地址：`test@example.com`
- mailboxId：邮箱列表结果里的 `id`，例如 `mbx_xxxxx`

示例流程：

```bash
curl http://127.0.0.1:3001/api/mailboxes
```

返回结果中你会看到类似：

```json
{
  "items": [
    {
      "id": "mbx_abc123",
      "address": "test@example.com"
    }
  ]
}
```

此时：

- `address` 用来确认你要查的是哪个邮箱
- `id` 就是后续 API 调用里要用的 `mailboxId`

#### 查询某个邮箱的邮件列表（Bearer Token）

```bash
curl http://127.0.0.1:3001/api/mailboxes/<mailboxId>/messages \
  -H "Authorization: Bearer <token>"
```

#### 查询单封邮件详情（Bearer Token）

```bash
curl http://127.0.0.1:3001/api/messages/<messageId> \
  -H "Authorization: Bearer <token>"
```

#### Token 失效

删除某个 Token 后，使用该 Token 的后续请求会立即返回 `401`。

## 8. 健康检查

先确认后端 HTTP 已正常启动：

```bash
curl http://127.0.0.1:3001/api/health
```

预期返回：

```json
{
  "ok": true
}
```

如果这里失败，先不要继续测 SMTP，优先排查后端启动问题。

---

## 9. 基本使用流程

推荐先通过前端页面操作，也可以直接通过 API。

### 8.1 查询现有域名

```bash
curl http://127.0.0.1:3001/api/domains
```

### 8.2 创建域名

Windows `cmd` 示例：

```bat
curl -X POST http://127.0.0.1:3001/api/domains ^
  -H "Content-Type: application/json" ^
  -d "{\"domain\":\"example.com\",\"note\":\"主收件域名\"}"
```

Linux / macOS 示例：

```bash
curl -X POST http://127.0.0.1:3001/api/domains \
  -H "Content-Type: application/json" \
  -d '{"domain":"example.com","note":"主收件域名"}'
```

### 8.3 查询现有邮箱

```bash
curl http://127.0.0.1:3001/api/mailboxes
```

### 8.4 创建邮箱

Windows `cmd` 示例：

```bat
curl -X POST http://127.0.0.1:3001/api/mailboxes ^
  -H "Content-Type: application/json" ^
  -d "{\"domainId\":\"<domainId>\",\"localPart\":\"test\"}"
```

Linux / macOS 示例：

```bash
curl -X POST http://127.0.0.1:3001/api/mailboxes \
  -H "Content-Type: application/json" \
  -d '{"domainId":"<domainId>","localPart":"test"}'
```

其中 `<domainId>` 需要先通过 [`GET /api/domains`](README.md:215) 获取。

创建成功后，目标邮箱地址类似：

```text
test@example.com
```

---

## 10. SMTP 收件测试

### 10.1 使用 swaks 测试

```bash
swaks --server 127.0.0.1 --port 2525 --to test@example.com --from hello@abc.com --header "Subject: quick test" --body "hello"
```

### 10.2 使用 Python 标准库测试

```bash
python - <<'PY'
import smtplib
from email.message import EmailMessage

msg = EmailMessage()
msg["Subject"] = "SMTP 收件测试"
msg["From"] = "hello@abc.com"
msg["To"] = "test@example.com"
msg.set_content("这是一封通过 2525 端口投递的测试邮件。")

with smtplib.SMTP("127.0.0.1", 2525, timeout=10) as smtp:
    smtp.send_message(msg)

print("sent")
PY
```

Windows 可以将脚本保存为 `test_mail.py` 后执行：

```powershell
python .\test_mail.py
```

### 10.3 手工 SMTP 对话

```text
EHLO localhost
MAIL FROM:<hello@abc.com>
RCPT TO:<test@example.com>
DATA
Subject: 手工测试
From: hello@abc.com
To: test@example.com

这是一封手工输入的测试邮件。
.
QUIT
```

---

## 11. 查看是否已收到邮件

### 11.1 查询邮箱列表

```bash
curl http://127.0.0.1:3001/api/mailboxes
```

从结果中找到目标邮箱的 `id`，这个值就是后续邮件查询接口需要使用的 `mailboxId`。

### 11.2 查询某个邮箱的邮件列表

这里的 `<mailboxId>` 就是上一步邮箱列表结果中的 `id` 字段，不是邮箱地址本身。

管理员已登录时：

```bash
curl http://127.0.0.1:3001/api/mailboxes/<mailboxId>/messages
```

使用 Bearer Token 时：

```bash
curl http://127.0.0.1:3001/api/mailboxes/<mailboxId>/messages \
  -H "Authorization: Bearer <token>"
```

例如：

```bash
curl http://127.0.0.1:3001/api/mailboxes/123/messages \
  -H "Authorization: Bearer dm_xxx"
```

### 11.3 查询单封邮件详情

管理员已登录时：

```bash
curl http://127.0.0.1:3001/api/messages/<messageId>
```

使用 Bearer Token 时：

```bash
curl http://127.0.0.1:3001/api/messages/<messageId> \
  -H "Authorization: Bearer <token>"
```

例如：

```bash
curl http://127.0.0.1:3001/api/messages/456 \
  -H "Authorization: Bearer dm_xxx"
```

### 11.4 前端对应接口

前端对邮件相关接口的封装在 `frontend/src/api.js` 中，主要包括：

- `getMailboxes`
- `createMailbox`
- `getMailboxMessages`
- `getMessageDetail`
- `markMessageRead`
- `deleteMessage`
- `updateMailboxRetention`

---

## 12. 推荐测试顺序

建议按以下顺序执行：

1. 启动后端
2. 调用 `GET /api/health`
3. 创建域名
4. 创建邮箱
5. 向 `127.0.0.1:2525` 发测试邮件
6. 查询 `/api/mailboxes/:id/messages`
7. 查询 `/api/messages/:id`
8. 最后通过前端页面确认展示效果

这样可以把问题拆分为：

- HTTP 启动问题
- SMTP 接收问题
- 数据落库问题
- 前端展示问题

---

## 13. Ubuntu VPS 部署要点

当前仓库未包含单独的 `DEPLOY.md` 或 `deploy.sh`，因此这里直接给出部署与排障所需的最小要点。

### 13.1 推荐部署目录

```bash
/opt/domain-mail
```

### 13.2 最小部署步骤

```bash
cd /opt/domain-mail/backend && npm ci
cd /opt/domain-mail/frontend && npm ci
cp /opt/domain-mail/backend/.env.example /opt/domain-mail/backend/.env
cd /opt/domain-mail/frontend && npm run build
cd /opt/domain-mail/backend && npm start
```

部署完成后，至少要看到以下启动日志：

```text
HTTP API listening on port 3001
SMTP receiver listening on 0.0.0.0:2525
```

### 13.3 部署后第一轮自检

1. 调用 `GET /api/health`
2. 在系统中创建目标域名
3. 在该域名下创建目标邮箱
4. 先从服务器本机向 `127.0.0.1:2525` 投递
5. 再检查 `/api/mailboxes/:id/messages` 是否能查到邮件
6. 本机收件正常后，再做公网 MX 投递验证

---

## 14. 手工部署概要

### 14.1 安装环境

```bash
apt update
apt install -y nginx git curl ufw
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
```

### 14.2 安装依赖

```bash
cd /opt/domain-mail/backend && npm ci
cd /opt/domain-mail/frontend && npm ci
```

### 14.3 配置后端

```bash
cp /opt/domain-mail/backend/.env.example /opt/domain-mail/backend/.env
```

默认示例：

```env
HTTP_PORT=3001
SMTP_PORT=2525
SMTP_HOST=0.0.0.0
CORS_ORIGIN=https://mail.example.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-password
SESSION_SECRET=change-this-session-secret
SESSION_MAX_AGE_MS=43200000
```

### 14.4 构建前端

```bash
cd /opt/domain-mail/frontend
printf "VITE_API_BASE_URL=https://mail.example.com\n" > .env.production
npm run build
```

---

## 15. Nginx 与 systemd

### Nginx

部署脚本会生成一个站点配置，核心逻辑是：

- 静态资源根目录指向 `frontend/dist`
- `/api/` 代理到本机后端 HTTP 服务

### systemd

部署脚本会创建 `domain-mail-backend.service`，关键点包括：

- `WorkingDirectory=$APP_DIR/backend`
- `ExecStart=/usr/bin/node src/index.js`
- `EnvironmentFile=$APP_DIR/backend/.env`

这也解释了为什么数据库文件会固定落在后端运行目录下。

---

## 16. DNS / MX 与公网真实收件排障

### 程序级验证

如果只是验证当前项目功能：

- 不必先配置公网 MX
- 直接对 `2525` 端口进行 SMTP 投递测试即可

### 公网真实收件

如果部署到服务器后，“从其他邮箱发件但没有收到”，优先按下面顺序排查：

1. 后端日志中是否出现 `SMTP receiver listening on 0.0.0.0:25`
2. `backend/.env` 中是否已将 `SMTP_PORT` 改为 `25`
3. 域名 DNS 的 A 记录是否指向 VPS 公网 IP
4. 根域名或目标域名的 MX 记录是否已指向该 SMTP 主机
5. 系统防火墙是否放行 `25/tcp`
6. 云平台安全组是否放行 `25/tcp`
7. 云厂商是否封禁了 `25` 出入方向端口
8. 是否已在系统中创建目标域名且状态为启用
9. 是否已在系统中创建完整收件地址对应的邮箱
10. 是否先用服务器本机对 `127.0.0.1:25` 做过 SMTP 自检

最小 DNS 参考：

```text
mail.example.com -> VPS 公网 IP
example.com MX -> mail.example.com
priority 10
```

推荐验证顺序：

1. 本机投递到 `127.0.0.1:25`，确认程序可收
2. 局域网或外网使用 `telnet VPS_IP 25` / `nc -vz VPS_IP 25`，确认端口可达
3. 最后再用 QQ、Gmail、Outlook 等外部邮箱做真实投递

---

## 17. 常见问题

### 17.1 `2525` 连不上

检查：

- 后端是否已启动
- 是否出现 `SMTP receiver listening on 0.0.0.0:2525`
- 是否被本机防火墙拦截
- 是否误发到了 HTTP 端口 `3001`

### 17.2 SMTP 返回域名无效

检查：

- 是否已创建目标域名
- 域名是否启用
- 收件地址域名是否拼写正确

例如创建的是：

```text
example.com
```

那么收件地址必须类似：

```text
test@example.com
```

### 17.3 SMTP 投递成功但查不到邮件

检查：

- 是否已创建对应邮箱
- 收件地址是否与系统邮箱完全一致
- 当前查看的 `mailboxId` 是否正确
- 是否查的是错误数据库文件

### 17.4 页面能打开但 API 报错

检查：

- `backend/.env` 中的 `CORS_ORIGIN`
- Nginx `/api/` 反代是否正确
- 后端服务是否正常运行

### 17.5 数据库没有数据

检查：

- systemd `WorkingDirectory` 是否指向 `backend`
- `data.db` 是否生成在后端运行目录
- 是否误切换工作目录导致写入到别处

---

## 18. 成功判定标准

满足以下条件，可认为项目部署或本地验证成功：

1. `GET /api/health` 返回成功
2. 前端页面可正常访问
3. 已创建邮箱能收到测试邮件
4. 邮件能在接口中查到
5. 邮件能在前端中查看
6. 如做公网版，外部邮箱可经 MX 正常投递

---

## 19. 补充文档

- `backend/.env.example`：后端环境变量示例
- `backend/src/smtp-utils.js`：SMTP 收件校验与日志辅助逻辑

---

## 20. 一句话总结

这个项目最重要的验证思路不是“调用某个发信接口”，而是：

**先创建域名和邮箱，再把邮件直接投递到后端 SMTP 服务，最后通过 API 或页面确认邮件是否被成功解析、入库并展示。**