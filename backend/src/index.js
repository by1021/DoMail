import 'dotenv/config';
import crypto from 'node:crypto';
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
  createDomain,
  createMailbox,
  db,
  generateRandomLocalPart,
  getDomainById,
  getDomainByName,
  getMailboxByAddress,
  listDomains,
  listMailboxes,
  listMessagesByMailbox,
  getMessageById,
  markMessageAsRead,
  purgeExpiredMessages,
  removeDomain,
  removeMailbox,
  removeMessage,
  saveIncomingMessage,
  updateMailboxRetention,
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
  domainId: z.string().min(1),
  localPart: z.string().min(1).max(64).regex(/^[a-zA-Z0-9._-]+$/).optional(),
  random: z.boolean().optional(),
});

const mailboxRetentionSchema = z.object({
  retentionValue: z.number().int().min(1).max(365).nullable().optional(),
  retentionUnit: z.enum(['hour', 'day']).nullable().optional(),
});

const loginSchema = z.object({
  username: z.string().min(1).max(128),
  password: z.string().min(1).max(256),
});

const smtpPort = Number(process.env.SMTP_PORT || 2525);
const httpPort = Number(process.env.HTTP_PORT || 3001);
const smtpHost = process.env.SMTP_HOST || '0.0.0.0';
const cleanupIntervalMs = Number(process.env.MESSAGE_CLEANUP_INTERVAL_MS || 5 * 60 * 1000);

let runningHttpServer = null;
let runningSmtpServer = null;
let cleanupTimer = null;

function buildError(status, code, message) {
  return { status, code, message };
}

function normalizeError(error) {
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

function sendError(response, error) {
  const normalized = normalizeError(error);
  response.status(normalized.status).json({
    ok: false,
    error: {
      code: normalized.code,
      message: normalized.message,
    },
  });
}

function sendAuthError(response, code = 'AUTH_REQUIRED', message = '请先登录管理账号') {
  response.status(401).json({
    ok: false,
    error: {
      code,
      message,
    },
  });
}

function generateMessageId() {
  return `msg_${crypto.randomUUID()}`;
}

function generateAttachmentId() {
  return `att_${crypto.randomUUID()}`;
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

function createSessionMiddleware(authConfig) {
  return session({
    name: 'domail.sid',
    secret: authConfig.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
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

  const messageId = generateMessageId();
  const receivedAt = new Date().toISOString();
  const attachments = parsed.attachments.map((attachment) => ({
    id: generateAttachmentId(),
    message_id: messageId,
    filename: attachment.filename ?? null,
    content_type: attachment.contentType ?? 'application/octet-stream',
    size: attachment.size ?? 0,
    content_id: attachment.cid ?? null,
    checksum: attachment.checksum ?? null,
  }));

  return saveIncomingMessage(
    {
      id: messageId,
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

export function createApp() {
  const authConfig = getAuthConfig();
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((item) => item.trim()).filter(Boolean);

  app.use(
    cors({
      origin: corsOrigin?.length ? corsOrigin : true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(createSessionMiddleware(authConfig));

  app.get('/api/health', (_request, response) => {
    const domainStatsStatement = db.prepare('SELECT COUNT(1) AS count FROM domains');
    const mailboxStatsStatement = db.prepare('SELECT COUNT(1) AS count FROM mailboxes');
    const messageStatsStatement = db.prepare('SELECT COUNT(1) AS count FROM messages');
    const stats = {
      domains: domainStatsStatement.get().count,
      mailboxes: mailboxStatsStatement.get().count,
      messages: messageStatsStatement.get().count,
    };

    response.json({
      ok: true,
      service: 'domain-mail-backend',
      stats,
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

      response.json({
        ok: true,
        item: {
          username: request.session.admin.username,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '登录参数不合法',
            details: error.flatten(),
          },
        });
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

  app.use('/api', requireAdminSession);

  app.get('/api/domains', (_request, response) => {
    response.json({
      ok: true,
      items: listDomains(),
    });
  });

  app.get('/api/domains/:id', (request, response) => {
    const item = getDomainById(request.params.id);

    if (!item) {
      response.status(404).json({
        ok: false,
        error: {
          code: 'DOMAIN_NOT_FOUND',
          message: '域名不存在',
        },
      });
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
        response.status(400).json({
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '域名参数不合法',
            details: error.flatten(),
          },
        });
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

  app.get('/api/mailboxes', (_request, response) => {
    response.json({
      ok: true,
      items: listMailboxes(),
    });
  });

  app.post('/api/mailboxes', (request, response) => {
    try {
      const payload = mailboxSchema.parse({
        domainId: request.body?.domainId,
        localPart: request.body?.localPart,
        random: request.body?.random ?? false,
      });

      const localPart = payload.random
        ? generateRandomLocalPart(10)
        : payload.localPart?.trim().toLowerCase();

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

      const created = createMailbox({
        domainId: payload.domainId,
        localPart,
        source: payload.random ? 'random' : 'manual',
      });

      response.status(201).json({
        ok: true,
        item: created,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '邮箱参数不合法',
            details: error.flatten(),
          },
        });
        return;
      }

      sendError(response, error);
    }
  });

  app.delete('/api/mailboxes/:id', (request, response) => {
    const deleted = removeMailbox(request.params.id);

    response.json({
      ok: deleted,
    });
  });

  app.patch('/api/mailboxes/:id/retention', (request, response) => {
    try {
      const payload = mailboxRetentionSchema.parse({
        retentionValue: request.body?.retentionValue ?? null,
        retentionUnit: request.body?.retentionUnit ?? null,
      });

      const item = updateMailboxRetention(request.params.id, payload);

      response.json({
        ok: true,
        item,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '自动清理参数不合法',
            details: error.flatten(),
          },
        });
        return;
      }

      sendError(response, error);
    }
  });

  app.get('/api/mailboxes/:id/messages', (request, response) => {
    const domainMailbox = listMailboxes().find((item) => item.id === request.params.id);

    if (!domainMailbox) {
      response.status(404).json({
        ok: false,
        error: {
          code: 'MAILBOX_NOT_FOUND',
          message: '邮箱不存在',
        },
      });
      return;
    }

    response.json({
      ok: true,
      mailbox: domainMailbox,
      items: listMessagesByMailbox(request.params.id),
    });
  });

  app.get('/api/messages/:id', (request, response) => {
    const item = getMessageById(request.params.id);

    if (!item) {
      response.status(404).json({
        ok: false,
        error: {
          code: 'MESSAGE_NOT_FOUND',
          message: '邮件不存在',
        },
      });
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
      response.status(404).json({
        ok: false,
        error: {
          code: 'MESSAGE_NOT_FOUND',
          message: '邮件不存在',
        },
      });
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
      response.status(404).json({
        ok: false,
        error: {
          code: 'MESSAGE_NOT_FOUND',
          message: '邮件不存在',
        },
      });
      return;
    }

    response.json({
      ok: true,
    });
  });

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
      const domain = getDomainByName(domainName);
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
          messageId: savedMessage.id,
          mailboxId: savedMessage.mailboxId,
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
      const removedCount = purgeExpiredMessages();

      if (removedCount > 0) {
        console.log(`Purged ${removedCount} expired messages`);
      }
    } catch (error) {
      console.error('Failed to purge expired messages', error);
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

export { db };