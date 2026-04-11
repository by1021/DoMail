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
- VPS 一键部署脚本：`deploy.sh`

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
- Vitest

---

## 3. 目录结构

```text
.
├─ backend/
│  ├─ src/
│  │  ├─ index.js
│  │  └─ db.js
│  ├─ test/
│  ├─ .env.example
│  └─ package.json
├─ frontend/
│  ├─ src/
│  │  ├─ api.js
│  │  ├─ App.jsx
│  │  └─ components/
│  └─ package.json
├─ deploy.sh
├─ DEPLOY.md
├─ 收件测试操作说明.md
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
```

当前项目默认行为：

- HTTP API 默认监听 `3001`
- SMTP 默认监听 `2525`
- SMTP 默认监听地址 `0.0.0.0`

对应实现可见 `backend/src/index.js` 中的启动逻辑。

前端默认 API 地址见 `frontend/src/api.js`：

- 开发时默认回退到 `http://localhost:3001`
- 生产环境可通过 `VITE_API_BASE_URL` 覆盖

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

---

## 7. 健康检查

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

## 8. 基本使用流程

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
  -d "{\"name\":\"example.com\"}"
```

Linux / macOS 示例：

```bash
curl -X POST http://127.0.0.1:3001/api/domains \
  -H "Content-Type: application/json" \
  -d '{"name":"example.com"}'
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
  -d "{\"domain\":\"example.com\",\"localPart\":\"test\"}"
```

Linux / macOS 示例：

```bash
curl -X POST http://127.0.0.1:3001/api/mailboxes \
  -H "Content-Type: application/json" \
  -d '{"domain":"example.com","localPart":"test"}'
```

创建成功后，目标邮箱地址类似：

```text
test@example.com
```

---

## 9. SMTP 收件测试

完整说明可见 `收件测试操作说明.md`。这里给出 README 中最常用的最短路径。

### 9.1 使用 swaks 测试

```bash
swaks --server 127.0.0.1 --port 2525 --to test@example.com --from hello@abc.com --header "Subject: quick test" --body "hello"
```

### 9.2 使用 Python 标准库测试

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

### 9.3 手工 SMTP 对话

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

## 10. 查看是否已收到邮件

### 10.1 查询邮箱列表

```bash
curl http://127.0.0.1:3001/api/mailboxes
```

从结果中找到目标邮箱的 `id`。

### 10.2 查询某个邮箱的邮件列表

```bash
curl http://127.0.0.1:3001/api/mailboxes/<mailboxId>/messages
```

例如：

```bash
curl http://127.0.0.1:3001/api/mailboxes/123/messages
```

### 10.3 查询单封邮件详情

```bash
curl http://127.0.0.1:3001/api/messages/<messageId>
```

例如：

```bash
curl http://127.0.0.1:3001/api/messages/456
```

### 10.4 前端对应接口

前端对邮件相关接口的封装在 `frontend/src/api.js` 中，主要包括：

- `getMailboxes`
- `createMailbox`
- `getMailboxMessages`
- `getMessageDetail`
- `markMessageRead`
- `deleteMessage`
- `updateMailboxRetention`

---

## 11. 推荐测试顺序

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

## 12. Ubuntu VPS 快速部署

详细说明见 `DEPLOY.md`，这里保留最常用路径。

### 12.1 推荐部署目录

```bash
/opt/domain-mail
```

### 12.2 一键部署

项目根目录执行：

```bash
chmod +x ./deploy.sh
DOMAIN=mail.example.com APP_DIR=/opt/domain-mail ./deploy.sh
```

### 12.3 可选参数

```bash
DOMAIN=mail.example.com
API_DOMAIN=mail.example.com
APP_DIR=/opt/domain-mail
HTTP_PORT=3001
SMTP_PORT=2525
SMTP_HOST=0.0.0.0
SITE_NAME=domain-mail
NODE_MAJOR=22
```

### 12.4 脚本自动完成内容

`deploy.sh` 会自动：

1. 安装 Node.js、Nginx、git、ufw
2. 同步项目到目标目录
3. 安装前后端依赖
4. 生成 `backend/.env`
5. 生成 `frontend/.env.production`
6. 构建前端
7. 生成 systemd 服务
8. 生成 Nginx 站点配置
9. 启动后端服务
10. 重载 Nginx
11. 放行 HTTP/HTTPS/SMTP 端口

---

## 13. 手工部署概要

### 13.1 安装环境

```bash
apt update
apt install -y nginx git curl ufw
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
```

### 13.2 安装依赖

```bash
cd /opt/domain-mail/backend && npm ci
cd /opt/domain-mail/frontend && npm ci
```

### 13.3 配置后端

```bash
cp /opt/domain-mail/backend/.env.example /opt/domain-mail/backend/.env
```

默认示例：

```env
HTTP_PORT=3001
SMTP_PORT=2525
SMTP_HOST=0.0.0.0
CORS_ORIGIN=https://mail.example.com
```

### 13.4 构建前端

```bash
cd /opt/domain-mail/frontend
printf "VITE_API_BASE_URL=https://mail.example.com\n" > .env.production
npm run build
```

---

## 14. Nginx 与 systemd

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

## 15. DNS / MX 说明

### 程序级验证

如果只是验证当前项目功能：

- 不必先配置公网 MX
- 直接对 `2525` 端口进行 SMTP 投递测试即可

### 公网真实收件

如果希望外部邮箱真实投递，通常需要：

1. MX 已生效
2. `SMTP_PORT=25`
3. 系统防火墙放行 `25/tcp`
4. 云平台安全组放行 `25/tcp`
5. 云厂商未封禁 25 端口

最小 DNS 参考：

```text
mail.example.com -> VPS 公网 IP
example.com MX -> mail.example.com
priority 10
```

---

## 16. 测试与验证

### 后端测试

```bash
cd backend
npm run test:db
```

### 前端测试

```bash
cd frontend
npm test
```

### 前端构建验证

```bash
cd frontend
npm run build
```

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

- `收件测试操作说明.md`：本地 SMTP 收件验证详细步骤
- `DEPLOY.md`：Ubuntu VPS 部署、Nginx、systemd、DNS/MX 说明
- `deploy.sh`：一键部署脚本
- `backend/.env.example`：后端环境变量示例

---

## 20. 一句话总结

这个项目最重要的验证思路不是“调用某个发信接口”，而是：

**先创建域名和邮箱，再把邮件直接投递到后端 SMTP 服务，最后通过 API 或页面确认邮件是否被成功解析、入库并展示。**