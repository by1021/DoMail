import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { simpleParser } from 'mailparser';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { SMTPServer } from 'smtp-server';
import { z } from 'zod';
import {
  buildSmtpSessionMeta,
  createRecipientValidationError,
  resolveRecipientDomainStatus,
} from './smtp-utils.js';
import {
  buildMailboxDomain,
  createApiToken,
  createDomain,
  createMailbox,
  db,
  detectDomainDnsStatus,
  generateRandomLocalPart,
  getApiTokenByHash,
  getDomainById,
  getDomainByNameOrSubdomain,
  getMailboxByAddress,
  getLatestMessageByMailboxAddress,
  getMessageById,
  getSessionById,
  listApiTokens,
  listDomains,
  listMailboxes,
  listMessagesByMailboxAddress,
  markMessageAsRead,
  purgeExpiredMailboxes,
  purgeExpiredMessages,
  purgeExpiredSessions,
  removeApiToken,
  removeDomain,
  removeMailboxByAddress,
  removeMessage,
  removeSessionById,
  saveIncomingMessage,
  touchApiTokenLastUsedAt,
  updateMailboxMessageRetentionByAddress,
  updateMailboxRetentionByAddress,
  upsertSession,
} from './db.js';

const dnsRecordSchema = z.object({
  type: z.string().min(1).max(16),
  name: z.string().min(1).max(255),
  value: z.string().min(1).max(1000),
  priority: z.number().int().min(0).max(65535).optional(),
  proxied: z.boolean().optional(),
  status: z.string().min(1).max(64).optional(),
  note: z.string().max(500).optional(),
});

const domainSchema = z.object({
  domain: z.string().min(3).max(255),
  smtpHost: z.string().min(1).max(255).optional().nullable(),
  smtpPort: z.number().int().min(1).max(65535).optional().nullable(),
  note: z.string().max(500).optional(),
  dnsRecords: z.array(dnsRecordSchema).max(20).optional(),
  setupNote: z.string().max(1000).optional(),
});

const mailboxSchema = z.object({
  domain: z.string().min(1).max(255),
  localPart: z.string().min(1).max(64).regex(/^[a-zA-Z0-9._-]+$/).optional(),
  random: z.boolean().optional(),
  randomSubdomain: z.boolean().optional(),
  subdomain: z.string().min(1).max(63).regex(/^[a-zA-Z0-9-]+$/).optional(),
});

const mailboxRetentionSchema = z.object({
  retentionValue: z.number().int().min(1).max(365).nullable().optional(),
  retentionUnit: z.enum(['hour', 'day']).nullable().optional(),
});

const loginSchema = z.object({
  username: z.string().min(1).max(128),
  password: z.string().min(1).max(256),
});

const apiTokenSchema = z.object({
  name: z.string().min(1).max(120),
});

const smtpPort = Number(process.env.SMTP_PORT || 2525);
const httpPort = Number(process.env.HTTP_PORT || 3001);
const smtpHost = process.env.SMTP_HOST || '0.0.0.0';
const cleanupIntervalMs = Number(process.env.MAILBOX_CLEANUP_INTERVAL_MS || process.env.MESSAGE_CLEANUP_INTERVAL_MS || 5 * 60 * 1000);

let runningHttpServer = null;
let runningSmtpServer = null;
let cleanupTimer = null;

const healthStatsStatements = {
  domains: db.prepare('SELECT COUNT(1) AS count FROM domains'),
  mailboxes: db.prepare('SELECT COUNT(1) AS count FROM mailboxes'),
  messages: db.prepare('SELECT COUNT(1) AS count FROM messages'),
};

const publicApiPaths = new Set([
  '/health',
  '/auth/login',
  '/auth/logout',
  '/auth/session',
]);

const apiTokenProtectedGetPaths = [
  /^\/mailboxes$/,
  /^\/mailboxes\/[^/]+\/messages$/,
  /^\/mailboxes\/[^/]+\/latest-message$/,
  /^\/messages\/[^/]+$/,
];

const apiTokenProtectedWritePaths = [
  /^\/mailboxes(?:\/[^/]+)?(?:\/retention|\/message-retention)?$/,
];

function buildError(status, code, message) {
  return { status, code, message };
}

function normalizeError(error) {
  if (error?.message === 'MAILBOX_ALREADY_EXISTS') {
    return buildError(409, 'MAILBOX_ALREADY_EXISTS', '该邮箱已存在，请更换前缀或子域名');
  }

  if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return buildError(409, 'CONFLICT', '记录已存在');
  }

  if (error?.message === 'DOMAIN_NOT_FOUND') {
    return buildError(404, 'DOMAIN_NOT_FOUND', '域名不存在');
  }

  if (error?.message === 'MAILBOX_NOT_FOUND') {
    return buildError(404, 'MAILBOX_NOT_FOUND', '邮箱不存在');
  }

  if (error?.message === 'INVALID_RETENTION_VALUE') {
    return buildError(400, 'INVALID_RETENTION_VALUE', '自动清理时间必须是大于 0 的整数');
  }

  if (error?.message === 'INVALID_RETENTION_UNIT') {
    return buildError(400, 'INVALID_RETENTION_UNIT', '自动清理单位只支持 hour 或 day');
  }

  return buildError(500, 'INTERNAL_ERROR', '服务器内部错误');
}

function sendErrorResponse(response, status, error) {
  response.status(status).json({
    ok: false,
    error,
  });
}

function sendError(response, error) {
  const normalized = normalizeError(error);
  sendErrorResponse(response, normalized.status, {
    code: normalized.code,
    message: normalized.message,
  });
}

function sendAuthError(response, code = 'AUTH_REQUIRED', message = '请先登录管理账号') {
  sendErrorResponse(response, 401, {
    code,
    message,
  });
}

function sendValidationError(response, error, message) {
  sendErrorResponse(response, 400, {
    code: 'VALIDATION_ERROR',
    message,
    details: error.flatten(),
  });
}

function sendNotFoundError(response, code, message) {
  sendErrorResponse(response, 404, {
    code,
    message,
  });
}

function generateStoredMessageId() {
  return `msg_${crypto.randomUUID()}`;
}

function createMailboxConflictError() {
  return {
    status: 409,
    code: 'MAILBOX_RANDOM_GENERATION_FAILED',
    message: '随机邮箱生成多次冲突，请稍后重试',
  };
}

function generateAttachmentId() {
  return `att_${crypto.randomUUID()}`;
}

function generateApiTokenValue() {
  return `dm_${crypto.randomBytes(24).toString('hex')}`;
}

function generateApiTokenId() {
  return `tok_${crypto.randomUUID()}`;
}

function hashApiToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseBearerToken(request) {
  const authorization = request.headers.authorization;

  if (!authorization || typeof authorization !== 'string') {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function readRawStream(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    stream.on('data', (chunk) => {
      chunks.push(chunk);
    });

    stream.once('end', () => {
      resolve(Buffer.concat(chunks));
    });

    stream.once('error', reject);
  });
}

function logSmtpEvent(level, message, details = {}) {
  const payload = Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined),
  );

  console[level](`[smtp] ${message}`, payload);
}

function getAuthConfig() {
  const adminUsername = process.env.ADMIN_USERNAME?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.SESSION_SECRET;
  const sessionMaxAgeMs = Number(process.env.SESSION_MAX_AGE_MS || 12 * 60 * 60 * 1000);

  const missing = [
    !adminUsername && 'ADMIN_USERNAME',
    !adminPassword && 'ADMIN_PASSWORD',
    !sessionSecret && 'SESSION_SECRET',
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Missing required auth environment variables: ${missing.join(', ')}`);
  }

  return {
    adminUsername,
    adminPassword,
    sessionSecret,
    sessionMaxAgeMs: Number.isFinite(sessionMaxAgeMs) && sessionMaxAgeMs > 0
      ? sessionMaxAgeMs
      : 12 * 60 * 60 * 1000,
  };
}

class SQLiteSessionStore extends session.Store {
  get(sid, callback) {
    try {
      const stored = getSessionById(sid);

      if (!stored) {
        callback(null, null);
        return;
      }

      if (stored.expiresAt <= new Date().toISOString()) {
        removeSessionById(sid);
        callback(null, null);
        return;
      }

      callback(null, stored.session);
    } catch (error) {
      callback(error);
    }
  }

  set(sid, sess, callback) {
    try {
      const cookieMaxAge = Number(sess?.cookie?.maxAge);
      const expiresAt = Number.isFinite(cookieMaxAge) && cookieMaxAge > 0
        ? new Date(Date.now() + cookieMaxAge).toISOString()
        : new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

      upsertSession({
        sid,
        session: sess,
        expiresAt,
      });

      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  destroy(sid, callback) {
    try {
      removeSessionById(sid);
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  touch(sid, sess, callback) {
    this.set(sid, sess, callback);
  }
}

function createSessionMiddleware(authConfig) {
  const isProduction = process.env.NODE_ENV === 'production';

  return session({
    store: new SQLiteSessionStore(),
    name: 'domail.sid',
    secret: authConfig.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    proxy: isProduction,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction ? 'auto' : false,
      maxAge: authConfig.sessionMaxAgeMs,
    },
  });
}

function destroySession(request) {
  return new Promise((resolve, reject) => {
    if (!request.session) {
      resolve();
      return;
    }

    request.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function regenerateSession(request) {
  return new Promise((resolve, reject) => {
    request.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function saveSession(request) {
  return new Promise((resolve, reject) => {
    if (!request.session) {
      resolve();
      return;
    }

    request.session.save((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function persistIncomingMail({ raw, session }) {
  const parsed = await simpleParser(raw);
  const envelopeTo = session.envelope.rcptTo?.[0]?.address?.toLowerCase();

  if (!envelopeTo) {
    throw new Error('MAILBOX_NOT_FOUND');
  }

  const mailbox = getMailboxByAddress(envelopeTo);

  if (!mailbox) {
    throw new Error('MAILBOX_NOT_FOUND');
  }

  const storedMessageId = generateStoredMessageId();
  const receivedAt = new Date().toISOString();
  const attachments = parsed.attachments.map((attachment) => ({
    id: generateAttachmentId(),
    message_id: storedMessageId,
    filename: attachment.filename ?? null,
    content_type: attachment.contentType ?? 'application/octet-stream',
    size: attachment.size ?? 0,
    content_id: attachment.cid ?? null,
    checksum: attachment.checksum ?? null,
  }));

  return saveIncomingMessage(
    {
      id: storedMessageId,
      mailbox_id: mailbox.id,
      message_id: parsed.messageId ?? null,
      envelope_from: session.envelope.mailFrom?.address ?? null,
      envelope_to: envelopeTo,
      from_name: parsed.from?.value?.[0]?.name ?? null,
      from_address: parsed.from?.value?.[0]?.address ?? null,
      subject: parsed.subject ?? '(no subject)',
      text_content: parsed.text ?? '',
      html_content: typeof parsed.html === 'string' ? parsed.html : '',
      received_at: receivedAt,
      raw_size: raw.length,
      attachment_count: attachments.length,
      is_read: 0,
    },
    attachments,
  );
}

function requireAdminSession(request, response, next) {
  if (request.session?.admin?.username) {
    next();
    return;
  }

  sendAuthError(response);
}

function requireApiAccess(request, response, next) {
  if (request.session?.admin?.username) {
    next();
    return;
  }

  const bearerToken = parseBearerToken(request);

  if (!bearerToken) {
    sendAuthError(response);
    return;
  }

  const apiToken = getApiTokenByHash(hashApiToken(bearerToken));

  if (!apiToken) {
    sendAuthError(response);
    return;
  }

  touchApiTokenLastUsedAt(apiToken.id);
  request.apiToken = {
    id: apiToken.id,
    name: apiToken.name,
    tokenPrefix: apiToken.tokenPrefix,
  };
  next();
}

function getHealthStats() {
  return {
    domains: healthStatsStatements.domains.get().count,
    mailboxes: healthStatsStatements.mailboxes.get().count,
    messages: healthStatsStatements.messages.get().count,
  };
}

function matchesAnyPath(path, matchers) {
  return matchers.some((pattern) => pattern.test(path));
}

function shouldAllowPublicApi(path) {
  return publicApiPaths.has(path);
}

function shouldUseApiTokenAccess(method, path) {
  if (method === 'GET') {
    return matchesAnyPath(path, apiTokenProtectedGetPaths);
  }

  if (['POST', 'DELETE', 'PATCH'].includes(method)) {
    return matchesAnyPath(path, apiTokenProtectedWritePaths);
  }

  return false;
}

export function createApp() {
  const authConfig = getAuthConfig();
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((item) => item.trim()).filter(Boolean);
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    app.set('trust proxy', true);
  }

  app.use(
    cors({
      origin: corsOrigin?.length ? corsOrigin : true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(createSessionMiddleware(authConfig));

  app.get('/api/health', (_request, response) => {
    response.json({
      ok: true,
      service: 'domain-mail-backend',
      stats: getHealthStats(),
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/auth/login', async (request, response) => {
    try {
      const payload = loginSchema.parse({
        username: request.body?.username,
        password: request.body?.password,
      });

      if (
        payload.username !== authConfig.adminUsername ||
        payload.password !== authConfig.adminPassword
      ) {
        sendAuthError(response, 'INVALID_CREDENTIALS', '账号或密码错误');
        return;
      }

      await regenerateSession(request);
      request.session.admin = {
        username: authConfig.adminUsername,
        loggedInAt: new Date().toISOString(),
      };
      await saveSession(request);

      response.set({
        'X-DoMail-Request-Secure': String(request.secure),
        'X-DoMail-Forwarded-Proto': String(request.headers['x-forwarded-proto'] ?? ''),
        'X-DoMail-Session-Id': String(request.sessionID ?? ''),
        'X-DoMail-Cookie-Secure': String(request.session.cookie.secure ?? ''),
      });

      response.json({
        ok: true,
        item: {
          username: request.session.admin.username,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendValidationError(response, error, '登录参数不合法');
        return;
      }

      sendError(response, error);
    }
  });

  app.get('/api/auth/session', (request, response) => {
    if (!request.session?.admin?.username) {
      sendAuthError(response);
      return;
    }

    response.json({
      ok: true,
      item: {
        username: request.session.admin.username,
      },
    });
  });

  app.post('/api/auth/logout', async (request, response) => {
    try {
      await destroySession(request);
      response.clearCookie('domail.sid');

      response.json({
        ok: true,
      });
    } catch (error) {
      sendError(response, error);
    }
  });

  app.use('/api', (request, response, next) => {
    if (shouldAllowPublicApi(request.path)) {
      next();
      return;
    }

    if (shouldUseApiTokenAccess(request.method, request.path)) {
      requireApiAccess(request, response, next);
      return;
    }

    requireAdminSession(request, response, next);
  });

  app.get('/api/domains', (_request, response) => {
    response.json({
      ok: true,
      items: listDomains(),
    });
  });

  app.get('/api/domains/:id', (request, response) => {
    const item = getDomainById(request.params.id);

    if (!item) {
      sendNotFoundError(response, 'DOMAIN_NOT_FOUND', '域名不存在');
      return;
    }

    response.json({
      ok: true,
      item,
    });
  });

  app.post('/api/domains', (request, response) => {
    try {
      const payload = domainSchema.parse({
        domain: request.body?.domain,
        smtpHost: request.body?.smtpHost ?? null,
        smtpPort: request.body?.smtpPort ?? null,
        note: request.body?.note ?? '',
        dnsRecords: request.body?.dnsRecords,
        setupNote: request.body?.setupNote ?? '',
      });

      const created = createDomain(payload);

      response.status(201).json({
        ok: true,
        item: created,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendValidationError(response, error, '域名参数不合法');
        return;
      }

      sendError(response, error);
    }
  });

  app.delete('/api/domains/:id', (request, response) => {
    const deleted = removeDomain(request.params.id);

    response.json({
      ok: deleted,
    });
  });

  app.post('/api/domains/:id/detect-dns', async (request, response) => {
    try {
      const item = await detectDomainDnsStatus(request.params.id);

      response.json({
        ok: true,
        item,
      });
    } catch (error) {
      sendError(response, error);
    }
  });

  app.get('/api/mailboxes', (_request, response) => {
    response.json({
      ok: true,
      items: listMailboxes(),
    });
  });

  app.post('/api/mailboxes', (request, response) => {
    try {
      const payload = mailboxSchema.parse({
        domain: request.body?.domain,
        localPart: request.body?.localPart,
        random: request.body?.random ?? false,
        randomSubdomain: request.body?.randomSubdomain ?? false,
        subdomain: request.body?.subdomain,
      });

      const normalizedManualLocalPart = payload.localPart?.trim().toLowerCase();
      const normalizedCustomSubdomain = payload.subdomain?.trim().toLowerCase();
      const useCustomSubdomain = Boolean(normalizedCustomSubdomain);
      const maxAttempts = payload.random || payload.randomSubdomain ? 12 : 1;
      const sourceParts = [];
      sourceParts.push(payload.random ? 'random' : 'manual');
      if (useCustomSubdomain) {
        sourceParts.push('custom-subdomain');
      } else if (payload.randomSubdomain) {
        sourceParts.push('subdomain');
      }

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const localPart = payload.random
          ? generateRandomLocalPart(12)
          : normalizedManualLocalPart;

        if (!localPart) {
          response.status(400).json({
            ok: false,
            error: {
              code: 'LOCAL_PART_REQUIRED',
              message: '未提供邮箱前缀，且未启用随机生成',
            },
          });
          return;
        }

        const { mailboxDomain, subdomainLabel } = buildMailboxDomain(payload.domain, {
          useRandomSubdomain: payload.randomSubdomain && !useCustomSubdomain,
          subdomainLabel: useCustomSubdomain ? normalizedCustomSubdomain : null,
          subdomainLength: 10,
        });

        try {
          const created = createMailbox({
            domain: payload.domain,
            mailboxDomain,
            localPart,
            source: sourceParts.join('-'),
          });

          response.status(201).json({
            ok: true,
            item: {
              ...created,
              subdomainLabel,
            },
          });
          return;
        } catch (error) {
          const isConflict = error?.message === 'MAILBOX_ALREADY_EXISTS';
          const canRetry = isConflict && attempt < maxAttempts && (payload.random || payload.randomSubdomain);

          if (canRetry) {
            continue;
          }

          if (isConflict && (payload.random || payload.randomSubdomain)) {
            sendErrorResponse(response, 409, createMailboxConflictError());
            return;
          }

          throw error;
        }
      }

      sendErrorResponse(response, 409, createMailboxConflictError());
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendValidationError(response, error, '邮箱参数不合法');
        return;
      }

      sendError(response, error);
    }
  });

  app.delete('/api/mailboxes/:address', (request, response) => {
    const deleted = removeMailboxByAddress(decodeURIComponent(request.params.address));

    response.json({
      ok: deleted,
    });
  });

  app.patch('/api/mailboxes/:address/retention', (request, response) => {
    try {
      const payload = mailboxRetentionSchema.parse({
        retentionValue: request.body?.retentionValue ?? null,
        retentionUnit: request.body?.retentionUnit ?? null,
      });

      const item = updateMailboxRetentionByAddress(decodeURIComponent(request.params.address), payload);

      response.json({
        ok: true,
        item,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendValidationError(response, error, '邮箱自动清理参数不合法');
        return;
      }

      sendError(response, error);
    }
  });

  app.patch('/api/mailboxes/:address/message-retention', (request, response) => {
    try {
      const payload = mailboxRetentionSchema.parse({
        retentionValue: request.body?.retentionValue ?? null,
        retentionUnit: request.body?.retentionUnit ?? null,
      });

      const item = updateMailboxMessageRetentionByAddress(
        decodeURIComponent(request.params.address),
        payload,
      );

      response.json({
        ok: true,
        item,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendValidationError(response, error, '邮件自动清理参数不合法');
        return;
      }

      sendError(response, error);
    }
  });

  app.get('/api/tokens', (_request, response) => {
    response.json({
      ok: true,
      items: listApiTokens(),
    });
  });

  app.post('/api/tokens', (request, response) => {
    try {
      const payload = apiTokenSchema.parse({
        name: request.body?.name,
      });

      const token = generateApiTokenValue();
      const item = createApiToken({
        id: generateApiTokenId(),
        name: payload.name.trim(),
        tokenHash: hashApiToken(token),
        tokenPrefix: token.slice(0, 12),
      });

      response.status(201).json({
        ok: true,
        item: {
          ...item,
          token,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendValidationError(response, error, 'API Token 参数不合法');
        return;
      }

      sendError(response, error);
    }
  });

  app.delete('/api/tokens/:id', (request, response) => {
    response.json({
      ok: removeApiToken(request.params.id),
    });
  });

  app.get('/api/mailboxes/:address/messages', (request, response) => {
    const mailboxAddress = decodeURIComponent(request.params.address);
    const domainMailbox = getMailboxByAddress(mailboxAddress);

    if (!domainMailbox) {
      sendNotFoundError(response, 'MAILBOX_NOT_FOUND', '邮箱不存在');
      return;
    }

    const latestOnly = ['1', 'true', 'yes'].includes(
      String(request.query?.latest ?? '').trim().toLowerCase(),
    );
    const items = listMessagesByMailboxAddress(mailboxAddress);

    response.json({
      ok: true,
      mailbox: domainMailbox,
      items: latestOnly ? items.slice(0, 1) : items,
      latest: latestOnly,
    });
  });

  app.get('/api/mailboxes/:address/latest-message', (request, response) => {
    const mailboxAddress = decodeURIComponent(request.params.address);
    const domainMailbox = getMailboxByAddress(mailboxAddress);

    if (!domainMailbox) {
      sendNotFoundError(response, 'MAILBOX_NOT_FOUND', '邮箱不存在');
      return;
    }

    const latestMessage = getLatestMessageByMailboxAddress(mailboxAddress);

    if (!latestMessage) {
      sendNotFoundError(response, 'MESSAGE_NOT_FOUND', '该邮箱暂无邮件');
      return;
    }

    response.json({
      ok: true,
      mailbox: domainMailbox,
      item: latestMessage,
    });
  });

  app.get('/api/messages/:id', (request, response) => {
    const item = getMessageById(request.params.id);

    if (!item) {
      sendNotFoundError(response, 'MESSAGE_NOT_FOUND', '邮件不存在');
      return;
    }

    response.json({
      ok: true,
      item,
    });
  });

  app.patch('/api/messages/:id/read', (request, response) => {
    const item = markMessageAsRead(request.params.id);

    if (!item) {
      sendNotFoundError(response, 'MESSAGE_NOT_FOUND', '邮件不存在');
      return;
    }

    response.json({
      ok: true,
      item,
    });
  });

  app.delete('/api/messages/:id', (request, response) => {
    const deleted = removeMessage(request.params.id);

    if (!deleted) {
      sendNotFoundError(response, 'MESSAGE_NOT_FOUND', '邮件不存在');
      return;
    }

    response.json({
      ok: true,
    });
  });

  // --- 生产模式: 服务前端静态文件 ---
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const frontendDistPath = path.resolve(__dirname, '..', 'public');

  if (isProduction && existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath, { maxAge: '7d', index: false }));

    // SPA fallback: 非 /api 路由返回 index.html
    app.get('*', (request, response, next) => {
      if (request.path.startsWith('/api')) {
        next();
        return;
      }

      response.sendFile(path.join(frontendDistPath, 'index.html'));
    });

    console.log(`[static] Serving frontend from ${frontendDistPath}`);
  }

  app.use((error, _request, response, _next) => {
    sendError(response, error);
  });

  return app;
}

export function createSmtpServer() {
  return new SMTPServer({
    disabledCommands: ['AUTH'],
    authOptional: true,
    allowInsecureAuth: true,
    logger: false,
    onRcptTo(address, session, callback) {
      const recipientAddress = String(address?.address ?? '').trim().toLowerCase();
      const domainName = recipientAddress.split('@')[1] || '';
      const domain = getDomainByNameOrSubdomain(domainName);
      const domainStatus = resolveRecipientDomainStatus({
        recipientAddress,
        domain,
      });

      if (!domainStatus.ok) {
        logSmtpEvent('warn', 'Recipient rejected during RCPT TO validation', {
          ...buildSmtpSessionMeta({ session }),
          recipient: domainStatus.recipient,
          recipientDomain: domainStatus.domain,
          reason: domainStatus.code,
        });
        callback(createRecipientValidationError({ recipientAddress }));
        return;
      }

      logSmtpEvent('info', 'Recipient accepted during RCPT TO validation', {
        ...buildSmtpSessionMeta({ session }),
        recipient: domainStatus.recipient,
        recipientDomain: domainStatus.domain,
      });
      callback();
    },
    async onData(stream, session, callback) {
      const sessionMeta = buildSmtpSessionMeta({ session });

      try {
        const raw = await readRawStream(stream);
        const savedMessage = await persistIncomingMail({ raw, session });

        logSmtpEvent('info', 'Incoming message stored', {
          ...sessionMeta,
          storedMessageId: savedMessage.id,
          mailboxAddress: savedMessage.address,
          rawSize: raw.length,
        });

        callback();
      } catch (error) {
        logSmtpEvent('error', 'Failed to store incoming message', {
          ...sessionMeta,
          errorMessage: error?.message ?? 'UNKNOWN_ERROR',
        });
        callback(error);
      }
    },
  });
}

export function startCleanupTask() {
  if (cleanupTimer) {
    return cleanupTimer;
  }

  cleanupTimer = setInterval(() => {
    try {
      const removedSessionCount = purgeExpiredSessions();
      const removedMailboxCount = purgeExpiredMailboxes();
      const removedMessageCount = purgeExpiredMessages();

      if (removedSessionCount > 0) {
        console.log(`Purged ${removedSessionCount} expired sessions`);
      }

      if (removedMailboxCount > 0) {
        console.log(`Purged ${removedMailboxCount} expired mailboxes`);
      }

      if (removedMessageCount > 0) {
        console.log(`Purged ${removedMessageCount} expired messages`);
      }
    } catch (error) {
      console.error('Failed to run cleanup tasks', error);
    }
  }, cleanupIntervalMs);

  return cleanupTimer;
}

export async function closeBackgroundServices() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }

  if (runningHttpServer) {
    await new Promise((resolve, reject) => {
      runningHttpServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    runningHttpServer = null;
  }

  if (runningSmtpServer) {
    await new Promise((resolve, reject) => {
      runningSmtpServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    runningSmtpServer = null;
  }
}

export function startRuntime() {
  const app = createApp();
  const smtpServer = createSmtpServer();

  startCleanupTask();

  runningHttpServer = app.listen(httpPort, () => {
    console.log(`HTTP API listening on port ${httpPort}`);
  });

  runningSmtpServer = smtpServer;
  smtpServer.listen(smtpPort, smtpHost, () => {
    console.log(`SMTP receiver listening on ${smtpHost}:${smtpPort}`);
  });

  return {
    app,
    smtpServer,
    httpServer: runningHttpServer,
  };
}

if (process.env.NODE_ENV !== 'test') {
  startRuntime();
}

export { db, saveIncomingMessage };