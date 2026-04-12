# DoMail Nginx 配置教程

本文档提供 DoMail 项目的 Nginx 生产部署示例，适用于将前端静态资源与后端 HTTP API 部署在同一台 Ubuntu / Debian 服务器上的场景。

配套示例配置文件见 [`deploy/nginx/domail.conf`](./domail.conf)。

---

## 1. 部署目标

当前项目的前后端关系如下：

- 前端生产构建产物目录：`/opt/domain-mail/frontend/dist`
- 后端 HTTP 服务默认监听：`127.0.0.1:3001`
- 前端生产环境 API 基础路径：`/api`
- 健康检查接口：`/api/health`

因此 Nginx 的职责是：

1. 对外提供前端静态页面
2. 将 `/api/` 请求反向代理到后端 Node.js 服务
3. 支持 React 单页应用（SPA）路由刷新回退到 `index.html`

---

## 2. 前置条件

建议先完成以下准备：

### 2.1 安装 Nginx

```bash
sudo apt update
sudo apt install -y nginx
```

### 2.2 安装并启动后端

确保后端已经能在本机正常监听 `3001` 端口，例如：

```bash
cd /opt/domain-mail/backend
npm ci
cp .env.example .env
npm start
```

后端启动后，应至少能通过以下命令访问健康检查接口：

```bash
curl http://127.0.0.1:3001/api/health
```

### 2.3 构建前端

```bash
cd /opt/domain-mail/frontend
npm ci
printf "VITE_API_BASE_URL=/api\n" > .env.production
npm run build
```

说明：

- 这里推荐将 `VITE_API_BASE_URL` 设置为 `/api`
- 这样前端页面和 API 同域部署时，不需要额外写完整域名
- 对应项目代码默认也兼容这种方式

---

## 3. 后端环境变量建议

后端 `.env` 至少建议包含以下内容：

```env
HTTP_PORT=3001
SMTP_PORT=2525
SMTP_HOST=0.0.0.0
CORS_ORIGIN=https://mail.example.com
```

注意：

- `HTTP_PORT` 要与 Nginx 反代目标保持一致，本文示例为 `3001`
- `CORS_ORIGIN` 建议填写实际访问前端的正式域名
- 如果你最终通过同域名访问前端和 API，`CORS_ORIGIN` 仍建议显式配置为正式 HTTPS 域名

---

## 4. Nginx 配置说明

示例配置文件内容见 [`deploy/nginx/domail.conf`](./domail.conf)。

### 4.1 核心逻辑

该配置完成了三件事：

1. `root /opt/domain-mail/frontend/dist;`
   - 指向前端构建产物目录

2. `location /api/`
   - 将 API 请求代理到 `http://127.0.0.1:3001/api/`

3. `location /`
   - 使用 `try_files $uri $uri/ /index.html;`
   - 解决 React 路由在刷新时出现 `404` 的问题

### 4.2 为什么 `proxy_pass` 要写成这样

示例中使用的是：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3001/api/;
}
```

这样可保持前端请求路径语义一致，例如：

- 浏览器请求：`/api/health`
- 转发到后端：`http://127.0.0.1:3001/api/health`

---

## 5. 启用站点配置

假设你的正式域名为 `mail.example.com`，并且项目部署在：

```text
/opt/domain-mail
```

### 5.1 复制配置文件

先将示例配置复制到 Nginx 站点目录：

```bash
sudo cp /opt/domain-mail/deploy/nginx/domail.conf /etc/nginx/sites-available/domail.conf
```

### 5.2 修改域名

编辑配置文件，将：

```nginx
server_name mail.example.com;
```

替换成你的真实域名。

例如：

```nginx
server_name mail.yourdomain.com;
```

### 5.3 启用站点

```bash
sudo ln -s /etc/nginx/sites-available/domail.conf /etc/nginx/sites-enabled/domail.conf
```

如果默认站点会冲突，可先移除：

```bash
sudo rm -f /etc/nginx/sites-enabled/default
```

### 5.4 校验并重载 Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

如果是首次启动，也可以使用：

```bash
sudo systemctl enable nginx
sudo systemctl restart nginx
```

---

## 6. 访问验证

### 6.1 验证前端页面

浏览器访问：

```text
http://mail.example.com
```

如果首页正常打开，说明静态资源服务正常。

### 6.2 验证 API 反代

```bash
curl http://mail.example.com/api/health
```

预期返回类似结果：

```json
{
  "ok": true,
  "service": "domain-mail-backend"
}
```

### 6.3 验证前端页面中的 API 调用

打开浏览器开发者工具，检查：

- 页面加载是否正常
- `/api/health`、`/api/domains` 等请求是否返回 `200`
- 是否存在跨域报错
- 是否出现 `502 Bad Gateway`

---

## 7. HTTPS 建议

生产环境建议启用 HTTPS。常见方式是使用 Certbot：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d mail.example.com
```

启用 HTTPS 后，记得同步确认以下内容：

- `CORS_ORIGIN` 是否改为 `https://你的域名`
- 浏览器访问地址是否已切换到 HTTPS
- 如站点有强制跳转，证书签发前不要先写死错误跳转逻辑

---

## 8. 常见问题排查

### 8.1 页面能打开，但 API 返回 502

通常说明 Nginx 已工作，但后端未正常运行。依次检查：

```bash
curl http://127.0.0.1:3001/api/health
ss -lntp | grep 3001
```

如果本机都访问失败，先排查后端服务本身。

### 8.2 页面刷新后出现 404

通常说明没有正确配置 SPA 回退。确认是否存在：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### 8.3 页面能打开，但前端请求跨域报错

优先检查后端 `.env` 中的 `CORS_ORIGIN` 是否与实际访问域名一致，例如：

```env
CORS_ORIGIN=https://mail.example.com
```

### 8.4 健康检查正常，但静态资源 404

优先检查：

- 是否执行过 `npm run build`
- `frontend/dist` 是否真实存在
- Nginx `root` 是否与实际部署目录一致

例如：

```bash
ls -la /opt/domain-mail/frontend/dist
```

### 8.5 数据库文件不在预期位置

这通常不是 Nginx 问题，而是后端启动目录问题。若使用 systemd，建议确保：

- `WorkingDirectory=/opt/domain-mail/backend`
- `ExecStart=/usr/bin/node src/index.js`

否则 SQLite 的 `data.db` 可能会生成到错误目录。

---

## 9. 推荐上线检查清单

上线前建议按顺序检查：

1. 后端本机 `3001` 健康检查通过
2. 前端已执行 `npm run build`
3. Nginx 配置文件中的 `server_name` 已替换为真实域名
4. `root` 路径与真实部署目录一致
5. `sudo nginx -t` 校验通过
6. 页面首页可正常打开
7. `/api/health` 通过域名访问正常
8. 前端页面实际操作时 `/api/*` 请求无异常

---

## 10. 推荐目录结构

生产环境建议目录结构如下：

```text
/opt/domain-mail
├─ backend
├─ frontend
│  └─ dist
└─ deploy
   └─ nginx
      ├─ domail.conf
      └─ README.md
```

---

## 11. 一句话总结

DoMail 的 Nginx 部署本质上就是：**让 Nginx 负责前端静态资源与 SPA 路由回退，再把 `/api/` 请求反向代理到本机 `3001` 端口的 Node.js 后端。**