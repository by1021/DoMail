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

这里要区分两个地址层次：

- `127.0.0.1:3001` 是 **服务器本机上的后端监听地址**，供 Nginx 在同机反向代理时访问
- `/api` 或 `https://你的域名/api` 才是 **浏览器与外部客户端在生产环境中应使用的访问地址**

因此 Nginx 的职责是：

1. 对外提供前端静态页面
2. 将 `/api/` 请求反向代理到后端 Node.js 服务
3. 支持 React 单页应用（SPA）路由刷新回退到 `index.html`
4. 在启用 Cloudflare 代理时，正确恢复访客真实 IP 并向后端透传 HTTPS 代理头

---

## 2. 前置条件

建议先完成以下准备：

### 2.1 安装 Nginx

```bash
sudo apt update
sudo apt install -y nginx
```

### 2.2 安装并启动后端

确保后端已经能在本机正常监听 `3001` 端口，推荐直接使用 PM2 托管：

```bash
cd /opt/domain-mail/backend
npm ci
cp .env.example .env
npm install -g pm2
pm2 start src/index.js --name domail-backend --update-env
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
- 浏览器会直接请求当前站点下的 `/api/*`，再由 Nginx 转发到本机 `127.0.0.1:3001`
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

## 4. Cloudflare 接入前先理解一件事

如果你准备启用 Cloudflare 橙云，需要先把 Web 流量和邮件流量区分开：

- Web 面板域名，例如 `mail.example.com`
  - 可以启用 Cloudflare 代理（橙云）
  - 用于前端页面和 `/api/*`
- 邮件主机名，例如 `mx.example.com`
  - 应保持 `DNS only`（灰云）
  - 用于 MX 记录和 SMTP 收件

原因是：标准 Cloudflare 代理适合 HTTP / HTTPS 站点，不适合直接代理普通 SMTP / MX 收件链路。

推荐做法：

```text
mail.example.com  -> 橙云 -> Nginx -> 127.0.0.1:3001
mx.example.com    -> 灰云 -> SMTP 25/2525
```

如果你把 MX 指向橙云主机名，邮件通常不会按预期工作。

---

## 5. Nginx 配置说明

示例配置文件内容见 [`deploy/nginx/domail.conf`](./domail.conf)。

### 5.1 核心逻辑

当前示例配置包含两个 `server` 块，分别处理 HTTP 与 HTTPS，并且仅服务当前 `server_name` 指定的域名：

1. `listen 80;`
   - 不再依赖固定的 `/.well-known/acme-challenge/` webroot 目录
   - 对直接访问源站的普通 HTTP 请求，继续 `301` 跳转到 `https://$host$request_uri`
   - 如果请求是由 Cloudflare 以 HTTPS 访客身份回源到 80 端口，会根据 `X-Forwarded-Proto` 判断并直接提供站点内容，避免回源重定向死循环
   - 证书申请以 [`certbot --nginx`](deploy/nginx/README.md:253) 为主，由 Certbot 临时接管 ACME challenge 路由

2. `listen 443 ssl;`
   - 提供当前域名的正式 HTTPS 站点访问
   - 静态资源根目录仍为 `/opt/domain-mail/frontend/dist`，且应放在 Nginx 工作进程可读取的目录中
   - `/api/` 继续反向代理到 `http://127.0.0.1:3001/api/`
   - `/` 继续使用 SPA 回退规则

3. `server_name mail.example.com;`
   - 表示当前服务仅通过这个正式域名对外访问
   - 如需上线，请替换为你的真实域名，并同步修改证书路径中的域名部分

### 5.2 HTTPS 证书路径说明

示例配置中默认使用：

```nginx
ssl_certificate /etc/letsencrypt/live/mail.example.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/mail.example.com/privkey.pem;
```

这表示：

- 站点已签发并安装对应域名证书
- 如果你的域名不是 `mail.example.com`，这里必须同步替换
- 在证书尚未签发成功前，不要直接启用这个 HTTPS `server` 块并重载 Nginx，否则 `nginx -t` 可能失败

### 5.3 为什么 `proxy_pass` 要写成这样

示例中使用的是：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3001/api/;
}
```

这样可保持前端请求路径语义一致，例如：

- 浏览器请求：`https://mail.example.com/api/health`
- Nginx 转发到后端：`http://127.0.0.1:3001/api/health`

也就是说，`127.0.0.1:3001` 只应出现在服务器内部转发链路中，不应作为生产环境前端页面里的公网请求地址。

### 5.4 Cloudflare 代理下为什么还要传代理头

当前示例除了基本反代，还专门处理了 Cloudflare 场景下的代理头与回源协议判断：

- `real_ip_header CF-Connecting-IP;`
- `set_real_ip_from ...`
- `proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;`
- `proxy_set_header X-Forwarded-Proto ...;`
- `proxy_set_header X-Forwarded-Host $host;`
- `proxy_set_header X-Forwarded-Port ...;`

这样做的目的有三个：

1. 让 Nginx 和后端都能识别真实访客 IP，而不是只看到 Cloudflare 回源节点 IP
2. 让后端明确知道外部访问链路是 HTTPS，避免登录 Cookie 在反向代理后被错误判断
3. 让 80 端口能够识别“访客是 HTTPS，但 Cloudflare 用 HTTP 回源”的情况，避免站点再次跳转到 HTTPS 造成循环

如果你的后台出现“登录成功后立刻退出”或“马上变成未登录”，优先检查这里。

> 建议：Cloudflare SSL/TLS 模式优先使用 `Full (strict)`。
> 当前示例即使在 Cloudflare 使用 HTTP 回源时也能避免首页打不开，但从安全角度仍应让 Cloudflare 到源站使用有效 TLS。

### 5.5 静态资源缓存策略

当前示例为前端静态资源添加了缓存优化：

- `.js` / `.css` / 图片 / 字体等资源缓存 `7d`
- `/api/` 响应显式返回 `Cache-Control: no-store`
- SPA 首页继续使用 `try_files $uri /index.html`

这样做的好处是：

- 更适合配合 Cloudflare 缓存前端资源
- 不会把动态 API 响应错误缓存
- 对中国访问链路较差时，有助于减少静态资源回源

---

## 6. 启用站点配置

假设你的正式域名为 `mail.example.com`，并且项目部署在：

```text
/opt/domain-mail
```

### 6.1 复制配置文件

先将示例配置复制到 Nginx 站点目录：

```bash
sudo cp /opt/domain-mail/deploy/nginx/domail.conf /etc/nginx/sites-available/domail.conf
```

### 6.2 修改域名

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

### 6.3 先签发 HTTPS 证书

如果你使用 Certbot，建议先确保域名已解析到当前服务器，再执行：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d mail.example.com
```

说明：

- 当前示例配置已经按 [`certbot --nginx`](deploy/nginx/README.md:253) 场景调整，不再要求预先创建固定的 webroot challenge 目录
- `certbot --nginx` 可能会临时改写或补充 Nginx 配置，因此签发完成后应再次核对最终生效配置是否仍保留 [`deploy/nginx/domail.conf`](./domail.conf) 中的 Cloudflare 回源兼容逻辑
- 特别要确认 80 端口没有被重新改回“无条件跳转 HTTPS”，否则 Cloudflare 代理开启后可能再次出现重定向循环

如果你已经有现成证书，也可以直接把 `ssl_certificate` 与 `ssl_certificate_key` 改成你的实际证书路径。

### 6.4 启用站点

```bash
sudo ln -s /etc/nginx/sites-available/domail.conf /etc/nginx/sites-enabled/domail.conf
```

如果默认站点会冲突，可先移除：

```bash
sudo rm -f /etc/nginx/sites-enabled/default
```

### 6.5 校验并重载 Nginx

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

## 7. 访问验证

### 7.1 验证 HTTP 是否跳转到 HTTPS

浏览器直接访问：

```text
http://mail.example.com
```

预期行为：

- 当访客是直接访问源站 HTTP 时，地址栏自动跳转到 `https://mail.example.com`
- 返回状态通常为 `301`

也可以直接用命令验证：

```bash
curl -I http://mail.example.com
```

如果你已经开启 Cloudflare 橙云，还建议额外检查一件事：

- 访客通过 `https://mail.example.com` 访问时，不应再因为 Cloudflare 到源站走 80 端口而出现重定向循环
- 如果浏览器报 `ERR_TOO_MANY_REDIRECTS`，优先检查 Cloudflare SSL/TLS 模式与当前 Nginx 配置是否已经同步更新

### 7.2 验证 HTTPS 页面

浏览器访问：

```text
https://mail.example.com
```

如果首页正常打开，说明 HTTPS 静态资源服务正常。

### 7.3 验证 API 反代

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

### 7.4 验证前端页面中的 API 调用

打开浏览器开发者工具，检查：

- 页面加载是否正常
- 实际请求地址是否为当前站点下的 `/api/health`、`/api/domains` 等同源路径
- `/api/health`、`/api/domains` 等请求是否返回 `200`
- 是否存在跨域报错
- 是否出现 `502 Bad Gateway`

### 7.5 验证登录态是否稳定

登录后台后，建议额外检查：

- 浏览器开发者工具里是否成功写入 Cookie
- 登录请求返回后，再访问受保护接口是否仍返回 `200`
- [`/api/auth/session`](backend/src/index.js:478) 是否能持续返回当前登录用户
- 页面刷新后是否仍保持登录状态

如果登录后立刻掉线，常见原因通常是：

- 浏览器访问的是 HTTPS，但后端没有正确识别反向代理头
- Nginx 没有正确传递 `X-Forwarded-Proto`
- 后端未启用反向代理兼容配置，导致 `Secure` Cookie 未被正确设置或回传
- 页面并未通过同域 `/api` 调用后端，而是请求了错误的源站地址

---

## 8. HTTPS 注意事项

当前示例已经是“HTTP 可访问，但统一跳转到 HTTPS；正式服务通过当前域名的 HTTPS 提供”的配置。

上线时请特别确认：

- `CORS_ORIGIN` 是否为 `https://你的域名`
- 浏览器访问地址是否已切换到 HTTPS
- 证书文件路径是否真实存在
- 域名 DNS 是否已正确解析到当前服务器
- 如站点有强制跳转，必须先保证证书签发完成，再启用 443 配置并重载 Nginx

---

## 9. 常见问题排查

### 9.1 页面能打开，但 API 返回 502

通常说明 Nginx 已工作，但后端未正常运行。依次检查：

```bash
curl http://127.0.0.1:3001/api/health
ss -lntp | grep 3001
```

如果本机都访问失败，先排查后端服务本身。

### 9.2 页面刷新后出现 404

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

### 9.3 页面能打开，但前端请求跨域报错

优先检查后端 `.env` 中的 `CORS_ORIGIN` 是否与实际访问域名一致，例如：

```env
CORS_ORIGIN=https://mail.example.com
```

### 9.4 首页直接返回 403 Forbidden

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

### 9.5 健康检查正常，但静态资源 404

优先检查：

- 是否执行过 `npm run build`
- `frontend/dist` 是否真实存在
- Nginx `root` 是否与实际部署目录一致

例如：

```bash
ls -la /opt/domain-mail/frontend/dist
```

### 9.6 数据库文件不在预期位置

这通常不是 Nginx 问题，而是后端启动目录问题。若使用 PM2，建议确保：

- 先执行 `cd /opt/domain-mail/backend`
- 再执行 `pm2 start src/index.js --name domail-backend --update-env`

否则 SQLite 的 `data.db` 可能会生成到错误目录。

### 9.7 登录后立刻自动退出

如果登录接口返回成功，但后续接口立刻变成 `401`，优先检查：

1. 浏览器是否真的收到了 `domail.sid`
2. 站点是否通过 HTTPS 访问
3. Nginx 是否已传递：
   - `X-Forwarded-Proto`
   - `X-Forwarded-Host`
   - `X-Forwarded-Port`
4. 后端是否运行在 `NODE_ENV=production`
5. 后端是否启用了反向代理兼容设置
6. 如果站点位于 Cloudflare 后面，Nginx 是否已识别 `CF-Connecting-IP`

建议直接检查：

```bash
curl -I https://mail.example.com/api/health
sudo nginx -t
pm2 logs domail-backend
```

如果你在改完 Nginx 或后端服务后才出现该问题，别忘了同时重启后端并重载 Nginx：

```bash
pm2 restart domail-backend --update-env
sudo systemctl reload nginx
```

### 9.8 开启 Cloudflare 代理后网站打不开或无限重定向

这类问题最常见的原因不是后端挂了，而是 **Cloudflare 回源协议** 与源站跳转策略冲突。

优先检查：

1. Cloudflare 的 Web 域名是否确实是当前 Nginx `server_name`
2. Cloudflare SSL/TLS 模式是否优先设置为 `Full (strict)`
3. 源站 80 端口是否仍然被旧配置无条件 `301` 到 HTTPS
4. 本次示例配置是否已包含基于 `X-Forwarded-Proto` 的回源判断
5. 证书是否真实安装在源站 443，并且路径可用

建议直接检查：

```bash
curl -I http://127.0.0.1
curl -I https://127.0.0.1 -k
sudo nginx -t
```

如果在 Cloudflare 开启橙云后浏览器提示：

- `ERR_TOO_MANY_REDIRECTS`
- `525 SSL handshake failed`
- `526 Invalid SSL certificate`

通常就应回头检查 Cloudflare SSL/TLS 模式、源站证书状态，以及当前 [`deploy/nginx/domail.conf`](./domail.conf) 是否已更新为 Cloudflare 兼容版本。

---

## 10. 推荐上线检查清单

上线前建议按顺序检查：

1. PM2 已托管后端，且 `pm2 status` 中可看到 `domail-backend`
2. 后端本机 `3001` 健康检查通过
3. 前端已执行 `npm run build`
4. 前端生产环境的 `VITE_API_BASE_URL` 已设为 `/api`，或确实配置成了你需要的完整 API 地址
5. Nginx 配置文件中的 `server_name` 已替换为真实域名
6. HTTPS 证书路径已替换为真实域名对应路径，且证书文件真实存在
7. `root` 路径与真实部署目录一致，且不要放在 `/root` 这类受限目录下
8. Nginx 用户对静态目录及其父目录具有读取/遍历权限
9. `sudo nginx -t` 校验通过
10. 如启用 Cloudflare，SSL/TLS 模式优先设为 `Full (strict)`
11. `http://你的域名` 会自动跳转到 `https://你的域名`
12. `https://你的域名` 页面首页可正常打开，且不会出现无限重定向
13. `/api/health` 通过 HTTPS 域名访问正常
14. 前端页面实际操作时 `/api/*` 请求无异常，且不再出现写死的 `127.0.0.1:3001`

---

## 11. 推荐目录结构

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

## 12. 一句话总结

DoMail 的 Nginx 部署本质上就是：**让当前域名的 80 端口负责跳转到 HTTPS，443 端口负责前端静态资源与 SPA 路由回退，并把 `/api/` 请求反向代理到本机 `3001` 端口的 Node.js 后端；如果前面再接 Cloudflare，还要额外处理真实 IP、缓存策略和 HTTPS 代理头，避免登录态立即失效。**