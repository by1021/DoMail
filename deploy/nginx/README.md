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

当前示例配置包含两个 `server` 块，分别处理 HTTP 与 HTTPS，并且仅服务当前 `server_name` 指定的域名：

1. `listen 80;`
   - 仅接收当前域名的明文 HTTP 请求
   - 保留 `/.well-known/acme-challenge/` 路径，便于 Certbot 或其他 ACME 工具签发证书
   - 其余请求统一 `301` 跳转到 `https://$host$request_uri`

2. `listen 443 ssl;`
   - 提供当前域名的正式 HTTPS 站点访问
   - 静态资源根目录仍为 `/opt/domain-mail/frontend/dist`，且应放在 Nginx 工作进程可读取的目录中
   - `/api/` 继续反向代理到 `http://127.0.0.1:3001/api/`
   - `/` 继续使用 SPA 回退规则

3. `server_name mail.example.com;`
   - 表示当前服务仅通过这个正式域名对外访问
   - 如需上线，请替换为你的真实域名，并同步修改证书路径中的域名部分

### 4.2 HTTPS 证书路径说明

示例配置中默认使用：

```nginx
ssl_certificate /etc/letsencrypt/live/mail.example.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/mail.example.com/privkey.pem;
```

这表示：

- 站点已签发并安装对应域名证书
- 如果你的域名不是 `mail.example.com`，这里必须同步替换
- 在证书尚未签发成功前，不要直接启用这个 HTTPS `server` 块并重载 Nginx，否则 `nginx -t` 可能失败

### 4.3 为什么 `proxy_pass` 要写成这样

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

编辑配置文件，将以下三处里的 `mail.example.com` 一并替换成你的真实域名：

```nginx
server_name mail.example.com;
ssl_certificate /etc/letsencrypt/live/mail.example.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/mail.example.com/privkey.pem;
```

例如：

```nginx
server_name mail.yourdomain.com;
ssl_certificate /etc/letsencrypt/live/mail.yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/mail.yourdomain.com/privkey.pem;
```

### 5.3 先签发 HTTPS 证书

如果你使用 Certbot，建议先确保域名已解析到当前服务器，再执行：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo mkdir -p /var/www/certbot
sudo certbot certonly --webroot -w /var/www/certbot -d mail.example.com
```

如果你希望继续使用 `--nginx` 方式，也可以在仅启用 80 端口站点后先完成签发，再把当前示例中的 443 配置一并补齐并启用。

如果你已经有现成证书，也可以直接把 `ssl_certificate` 与 `ssl_certificate_key` 改成你的实际证书路径。

### 5.4 启用站点

```bash
sudo ln -s /etc/nginx/sites-available/domail.conf /etc/nginx/sites-enabled/domail.conf
```

如果默认站点会冲突，可先移除：

```bash
sudo rm -f /etc/nginx/sites-enabled/default
```

### 5.5 校验并重载 Nginx

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

### 6.1 验证 HTTP 是否跳转到 HTTPS

浏览器访问：

```text
http://mail.example.com
```

预期行为：

- 地址栏自动跳转到 `https://mail.example.com`
- 返回状态通常为 `301`

也可以直接用命令验证：

```bash
curl -I http://mail.example.com
```

### 6.2 验证 HTTPS 页面

浏览器访问：

```text
https://mail.example.com
```

如果首页正常打开，说明 HTTPS 静态资源服务正常。

### 6.3 验证 API 反代

```bash
curl https://mail.example.com/api/health
```

预期返回类似结果：

```json
{
  "ok": true,
  "service": "domain-mail-backend"
}
```

### 6.4 验证前端页面中的 API 调用

打开浏览器开发者工具，检查：

- 页面加载是否正常
- `/api/health`、`/api/domains` 等请求是否返回 `200`
- 是否存在跨域报错
- 是否出现 `502 Bad Gateway`

---

## 7. HTTPS 注意事项

当前示例已经是“HTTP 可访问，但统一跳转到 HTTPS；正式服务通过当前域名的 HTTPS 提供”的配置。

上线时请特别确认：

- `CORS_ORIGIN` 是否为 `https://你的域名`
- 浏览器访问地址是否已切换到 HTTPS
- 证书文件路径是否真实存在
- 域名 DNS 是否已正确解析到当前服务器
- 如站点有强制跳转，必须先保证证书签发完成，再启用 443 配置并重载 Nginx

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
    try_files $uri /index.html;
}
```

说明：

- 对 React / Vite 这类 SPA，推荐直接回退到 `index.html`
- 不建议在这里写 `try_files $uri $uri/ /index.html;`
- 因为访问 `/` 时可能先命中静态目录本身，若目录索引关闭，部分环境会直接返回 `403 Forbidden`

### 8.3 页面能打开，但前端请求跨域报错

优先检查后端 `.env` 中的 `CORS_ORIGIN` 是否与实际访问域名一致，例如：

```env
CORS_ORIGIN=https://mail.example.com
```

### 8.4 首页直接返回 403 Forbidden

优先检查：

- Nginx `root` 是否指向了 `/root/...` 之类受限目录
- Nginx 工作进程用户（通常是 `www-data`）是否对静态目录及其所有父目录具有可执行/遍历权限
- `index.html` 是否真实存在于 `root` 指向的目录中
- SPA 回退是否写成了更稳妥的 `try_files $uri /index.html;`

建议：

- 将前端构建产物部署到 `/opt/domain-mail/frontend/dist`
- 避免把站点根目录放在 `/root` 下
- 至少验证以下路径可读：

```bash
ls -la /opt/domain-mail/frontend/dist
namei -l /opt/domain-mail/frontend/dist/index.html
```

### 8.5 健康检查正常，但静态资源 404

优先检查：

- 是否执行过 `npm run build`
- `frontend/dist` 是否真实存在
- Nginx `root` 是否与实际部署目录一致

例如：

```bash
ls -la /opt/domain-mail/frontend/dist
```

### 8.6 数据库文件不在预期位置

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
4. HTTPS 证书路径已替换为真实域名对应路径，且证书文件真实存在
5. `root` 路径与真实部署目录一致，且不要放在 `/root` 这类受限目录下
6. Nginx 用户对静态目录及其父目录具有读取/遍历权限
7. `sudo nginx -t` 校验通过
8. `http://你的域名` 会自动跳转到 `https://你的域名`
9. `https://你的域名` 页面首页可正常打开
10. `/api/health` 通过 HTTPS 域名访问正常
11. 前端页面实际操作时 `/api/*` 请求无异常

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

DoMail 的 Nginx 部署本质上就是：**让当前域名的 80 端口负责跳转到 HTTPS，443 端口负责前端静态资源与 SPA 路由回退，并把 `/api/` 请求反向代理到本机 `3001` 端口的 Node.js 后端。**