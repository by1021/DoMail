import path from 'node:path';
import { resolveMx } from 'node:dns/promises';
import { DatabaseSync } from 'node:sqlite';
import { customAlphabet } from 'nanoid';

const dbFilePath = path.resolve(process.cwd(), 'data.db');
const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);

export const db = new DatabaseSync(dbFilePath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS domains (
    id TEXT PRIMARY KEY,
    domain TEXT NOT NULL UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    smtp_host TEXT,
    smtp_port INTEGER,
    server_ip TEXT,
    mx_host TEXT,
    note TEXT,
    dns_records_json TEXT NOT NULL DEFAULT '[]',
    setup_note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mailboxes (
    id TEXT PRIMARY KEY,
    domain_id TEXT NOT NULL,
    local_part TEXT NOT NULL,
    address TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    retention_value INTEGER,
    retention_unit TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    mailbox_id TEXT NOT NULL,
    message_id TEXT,
    envelope_from TEXT,
    envelope_to TEXT NOT NULL,
    from_name TEXT,
    from_address TEXT,
    subject TEXT,
    text_content TEXT,
    html_content TEXT,
    received_at TEXT NOT NULL,
    raw_size INTEGER NOT NULL DEFAULT 0,
    attachment_count INTEGER NOT NULL DEFAULT 0,
    is_read INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    filename TEXT,
    content_type TEXT,
    size INTEGER NOT NULL DEFAULT 0,
    content_id TEXT,
    checksum TEXT,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS api_tokens (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    token_prefix TEXT NOT NULL,
    last_used_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_domains_domain ON domains(domain);
  CREATE INDEX IF NOT EXISTS idx_mailboxes_domain_id ON mailboxes(domain_id);
  CREATE INDEX IF NOT EXISTS idx_mailboxes_address ON mailboxes(address);
  CREATE INDEX IF NOT EXISTS idx_messages_mailbox_id ON messages(mailbox_id);
  CREATE INDEX IF NOT EXISTS idx_messages_received_at ON messages(received_at DESC);
  CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash);
  CREATE INDEX IF NOT EXISTS idx_api_tokens_created_at ON api_tokens(created_at DESC);
`);

const domainColumns = new Set(
  db
    .prepare(`PRAGMA table_info(domains)`)
    .all()
    .map((column) => column.name),
);

const domainMigrations = [
  {
    name: 'dns_records_json',
    sql: `ALTER TABLE domains ADD COLUMN dns_records_json TEXT NOT NULL DEFAULT '[]'`,
  },
  {
    name: 'setup_note',
    sql: `ALTER TABLE domains ADD COLUMN setup_note TEXT NOT NULL DEFAULT ''`,
  },
  {
    name: 'server_ip',
    sql: `ALTER TABLE domains ADD COLUMN server_ip TEXT`,
  },
  {
    name: 'mx_host',
    sql: `ALTER TABLE domains ADD COLUMN mx_host TEXT`,
  },
];

for (const migration of domainMigrations) {
  if (!domainColumns.has(migration.name)) {
    db.exec(migration.sql);
  }
}

const mailboxColumns = new Set(
  db
    .prepare(`PRAGMA table_info(mailboxes)`)
    .all()
    .map((column) => column.name),
);

const mailboxMigrations = [
  {
    name: 'retention_value',
    sql: `ALTER TABLE mailboxes ADD COLUMN retention_value INTEGER`,
  },
  {
    name: 'retention_unit',
    sql: `ALTER TABLE mailboxes ADD COLUMN retention_unit TEXT`,
  },
];

for (const migration of mailboxMigrations) {
  if (!mailboxColumns.has(migration.name)) {
    db.exec(migration.sql);
  }
}

const insertDomainStatement = db.prepare(`
  INSERT INTO domains (
    id,
    domain,
    is_active,
    smtp_host,
    smtp_port,
    server_ip,
    mx_host,
    note,
    dns_records_json,
    setup_note,
    created_at,
    updated_at
  )
  VALUES (
    @id,
    @domain,
    @is_active,
    @smtp_host,
    @smtp_port,
    @server_ip,
    @mx_host,
    @note,
    @dns_records_json,
    @setup_note,
    @created_at,
    @updated_at
  )
`);

const listDomainsStatement = db.prepare(`
  SELECT
    id,
    domain,
    is_active,
    smtp_host,
    smtp_port,
    server_ip,
    mx_host,
    note,
    dns_records_json,
    setup_note,
    created_at,
    updated_at
  FROM domains
  ORDER BY created_at DESC
`);

const getDomainByIdStatement = db.prepare(`
  SELECT
    id,
    domain,
    is_active,
    smtp_host,
    smtp_port,
    server_ip,
    mx_host,
    note,
    dns_records_json,
    setup_note,
    created_at,
    updated_at
  FROM domains
  WHERE id = ?
`);

const getDomainByNameStatement = db.prepare(`
  SELECT
    id,
    domain,
    is_active,
    smtp_host,
    smtp_port,
    server_ip,
    mx_host,
    note,
    dns_records_json,
    setup_note,
    created_at,
    updated_at
  FROM domains
  WHERE domain = ?
`);

const deleteDomainStatement = db.prepare(`
  DELETE FROM domains
  WHERE id = ?
`);

const updateDomainActiveStatusStatement = db.prepare(`
  UPDATE domains
  SET is_active = @is_active,
      updated_at = @updated_at
  WHERE id = @id
`);

const insertMailboxStatement = db.prepare(`
  INSERT INTO mailboxes (
    id,
    domain_id,
    local_part,
    address,
    source,
    is_active,
    retention_value,
    retention_unit,
    created_at,
    updated_at
  )
  VALUES (
    @id,
    @domain_id,
    @local_part,
    @address,
    @source,
    @is_active,
    @retention_value,
    @retention_unit,
    @created_at,
    @updated_at
  )
`);

const listMailboxesStatement = db.prepare(`
  SELECT
    m.id,
    m.domain_id,
    m.local_part,
    m.address,
    m.source,
    m.is_active,
    m.retention_value,
    m.retention_unit,
    m.created_at,
    m.updated_at,
    d.domain,
    (
      SELECT COUNT(1)
      FROM messages msg
      WHERE msg.mailbox_id = m.id
    ) AS message_count,
    (
      SELECT msg.received_at
      FROM messages msg
      WHERE msg.mailbox_id = m.id
      ORDER BY msg.received_at DESC
      LIMIT 1
    ) AS latest_received_at
  FROM mailboxes m
  INNER JOIN domains d ON d.id = m.domain_id
  ORDER BY m.created_at DESC
`);

const getMailboxByIdStatement = db.prepare(`
  SELECT
    m.id,
    m.domain_id,
    m.local_part,
    m.address,
    m.source,
    m.is_active,
    m.retention_value,
    m.retention_unit,
    m.created_at,
    m.updated_at,
    d.domain
  FROM mailboxes m
  INNER JOIN domains d ON d.id = m.domain_id
  WHERE m.id = ?
`);

const getMailboxByAddressStatement = db.prepare(`
  SELECT
    m.id,
    m.domain_id,
    m.local_part,
    m.address,
    m.source,
    m.is_active,
    m.retention_value,
    m.retention_unit,
    m.created_at,
    m.updated_at,
    d.domain
  FROM mailboxes m
  INNER JOIN domains d ON d.id = m.domain_id
  WHERE m.address = ?
`);

const deleteMailboxStatement = db.prepare(`
  DELETE FROM mailboxes
  WHERE id = ?
`);

const deleteMailboxByAddressStatement = db.prepare(`
  DELETE FROM mailboxes
  WHERE address = ?
`);

const updateMailboxRetentionStatement = db.prepare(`
  UPDATE mailboxes
  SET retention_value = @retention_value,
      retention_unit = @retention_unit,
      updated_at = @updated_at
  WHERE id = @id
`);

const updateMailboxRetentionByAddressStatement = db.prepare(`
  UPDATE mailboxes
  SET retention_value = @retention_value,
      retention_unit = @retention_unit,
      updated_at = @updated_at
  WHERE address = @address
`);

const deleteMessageStatement = db.prepare(`
  DELETE FROM messages
  WHERE id = ?
`);

const listMailboxRetentionStatement = db.prepare(`
  SELECT
    id,
    retention_value,
    retention_unit
  FROM mailboxes
  WHERE retention_value IS NOT NULL
    AND retention_unit IS NOT NULL
`);

const purgeExpiredMessagesByMailboxStatement = db.prepare(`
  DELETE FROM messages
  WHERE mailbox_id = ?
    AND received_at < ?
`);

const insertMessageStatement = db.prepare(`
  INSERT INTO messages (
    id,
    mailbox_id,
    message_id,
    envelope_from,
    envelope_to,
    from_name,
    from_address,
    subject,
    text_content,
    html_content,
    received_at,
    raw_size,
    attachment_count,
    is_read
  )
  VALUES (
    @id,
    @mailbox_id,
    @message_id,
    @envelope_from,
    @envelope_to,
    @from_name,
    @from_address,
    @subject,
    @text_content,
    @html_content,
    @received_at,
    @raw_size,
    @attachment_count,
    @is_read
  )
`);

const insertAttachmentStatement = db.prepare(`
  INSERT INTO attachments (
    id,
    message_id,
    filename,
    content_type,
    size,
    content_id,
    checksum
  )
  VALUES (
    @id,
    @message_id,
    @filename,
    @content_type,
    @size,
    @content_id,
    @checksum
  )
`);

const listMessagesByMailboxStatement = db.prepare(`
  SELECT
    msg.id,
    msg.message_id,
    msg.envelope_from,
    msg.envelope_to,
    msg.from_name,
    msg.from_address,
    msg.subject,
    msg.received_at,
    msg.raw_size,
    msg.attachment_count,
    msg.is_read
  FROM messages msg
  WHERE msg.mailbox_id = ?
  ORDER BY msg.received_at DESC
`);

const listMessagesByMailboxAddressStatement = db.prepare(`
  SELECT
    msg.id,
    msg.message_id,
    msg.envelope_from,
    msg.envelope_to,
    msg.from_name,
    msg.from_address,
    msg.subject,
    msg.received_at,
    msg.raw_size,
    msg.attachment_count,
    msg.is_read
  FROM messages msg
  INNER JOIN mailboxes mb ON mb.id = msg.mailbox_id
  WHERE mb.address = ?
  ORDER BY msg.received_at DESC
`);

const getMessageByIdStatement = db.prepare(`
  SELECT
    msg.id,
    msg.mailbox_id,
    msg.message_id,
    msg.envelope_from,
    msg.envelope_to,
    msg.from_name,
    msg.from_address,
    msg.subject,
    msg.text_content,
    msg.html_content,
    msg.received_at,
    msg.raw_size,
    msg.attachment_count,
    msg.is_read,
    mb.address
  FROM messages msg
  INNER JOIN mailboxes mb ON mb.id = msg.mailbox_id
  WHERE msg.id = ?
`);

const listAttachmentsByMessageStatement = db.prepare(`
  SELECT
    id,
    filename,
    content_type,
    size,
    content_id,
    checksum
  FROM attachments
  WHERE message_id = ?
  ORDER BY rowid ASC
`);

const markMessageReadStatement = db.prepare(`
  UPDATE messages
  SET is_read = 1
  WHERE id = ?
`);

const insertApiTokenStatement = db.prepare(`
  INSERT INTO api_tokens (
    id,
    name,
    token_hash,
    token_prefix,
    last_used_at,
    created_at,
    updated_at
  )
  VALUES (
    @id,
    @name,
    @token_hash,
    @token_prefix,
    @last_used_at,
    @created_at,
    @updated_at
  )
`);

const listApiTokensStatement = db.prepare(`
  SELECT
    id,
    name,
    token_prefix,
    last_used_at,
    created_at,
    updated_at
  FROM api_tokens
  ORDER BY created_at DESC
`);

const getApiTokenByHashStatement = db.prepare(`
  SELECT
    id,
    name,
    token_hash,
    token_prefix,
    last_used_at,
    created_at,
    updated_at
  FROM api_tokens
  WHERE token_hash = ?
`);

const deleteApiTokenStatement = db.prepare(`
  DELETE FROM api_tokens
  WHERE id = ?
`);

const touchApiTokenLastUsedAtStatement = db.prepare(`
  UPDATE api_tokens
  SET last_used_at = @last_used_at,
      updated_at = @updated_at
  WHERE id = @id
`);

function timestamp() {
  return new Date().toISOString();
}

function normalizeDomain(domain) {
  return domain.trim().toLowerCase();
}

function parseJsonArray(value, fallback = []) {
  if (!value) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeDnsRecords(records = []) {
  if (!Array.isArray(records)) {
    return [];
  }

  return records
    .map((record) => {
      const type = String(record?.type ?? '').trim().toUpperCase();
      const name = String(record?.name ?? '').trim() || '@';
      const value = String(record?.value ?? '').trim();

      if (!type || !value) {
        return null;
      }

      const normalized = {
        type,
        name,
        value,
        status: String(record?.status ?? 'pending').trim() || 'pending',
        proxied: Boolean(record?.proxied),
        note: String(record?.note ?? '').trim(),
      };

      if (record?.priority !== undefined && record?.priority !== null && record?.priority !== '') {
        normalized.priority = Number(record.priority);
      }

      return normalized;
    })
    .filter(Boolean);
}

function buildDnsHostLabel(domain, host) {
  const normalizedDomain = normalizeDomain(domain);
  const normalizedHost = String(host ?? '').trim().toLowerCase();

  if (!normalizedHost || normalizedHost === normalizedDomain) {
    return '@';
  }

  if (normalizedHost.endsWith(`.${normalizedDomain}`)) {
    return normalizedHost.slice(0, -(normalizedDomain.length + 1)) || '@';
  }

  return '@';
}

function getMailDnsConfig() {
  const mailMxHost = String(process.env.MAIL_MX_HOST ?? '').trim().toLowerCase() || null;

  return {
    mailMxHost,
  };
}

function normalizeDnsTarget(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\.+$/, '');
}

function buildDefaultDnsRecords(domain, smtpHost, serverIp, mxHost) {
  const normalizedMxHost =
    normalizeDnsTarget(mxHost) ||
    normalizeDnsTarget(smtpHost) ||
    `mail.${domain}`;

  return [
    {
      type: 'MX',
      name: '@',
      value: normalizedMxHost,
      priority: 10,
      status: 'pending',
      proxied: false,
      note: `接收 ${domain} 的入站邮件，MX 应指向 ${normalizedMxHost}`,
    },
  ];
}

function buildOptionalDnsRecords(domain) {
  return [
    {
      type: 'TXT',
      name: '@',
      value: `v=spf1 mx include:${domain} ~all`,
      status: 'pending',
      proxied: false,
      note: 'SPF 发信策略示例，请按实际发信源调整',
    },
    {
      type: 'TXT',
      name: '_dmarc',
      value: `v=DMARC1; p=none; rua=mailto:postmaster@${domain}`,
      status: 'pending',
      proxied: false,
      note: 'DMARC 监控策略',
    },
    {
      type: 'TXT',
      name: 'default._domainkey',
      value: 'k=rsa; p=REPLACE_WITH_DKIM_PUBLIC_KEY',
      status: 'pending',
      proxied: false,
      note: 'DKIM 公钥占位，后续可替换为真实值',
    },
  ];
}

function normalizeDnsGuidance(domain, options = {}) {
  const normalizedRecords = normalizeDnsRecords(options.dnsRecords);
  const dnsRecords = normalizedRecords.length
    ? normalizedRecords
    : buildDefaultDnsRecords(domain, options.smtpHost, options.serverIp, options.mxHost);
  const setupNote =
    String(options.setupNote ?? '').trim() ||
    '请先确认当前域名的 DNS 托管商，并将 MX 记录指向系统要求的收件主机；完成后再重新检测 DNS。';

  return {
    dnsRecords,
    setupNote,
  };
}

function normalizeAddress(localPart, domain) {
  return `${localPart.trim().toLowerCase()}@${normalizeDomain(domain)}`;
}

function normalizeMailboxAddress(address) {
  return String(address ?? '').trim().toLowerCase();
}

function normalizeRetentionPolicy(retention = {}) {
  const retentionValue =
    retention.retentionValue === null || retention.retentionValue === undefined || retention.retentionValue === ''
      ? null
      : Number(retention.retentionValue);

  const retentionUnit = retention.retentionUnit ? String(retention.retentionUnit).trim().toLowerCase() : null;

  if (retentionValue === null || retentionUnit === null) {
    return {
      retentionValue: null,
      retentionUnit: null,
    };
  }

  if (!Number.isInteger(retentionValue) || retentionValue <= 0) {
    throw new Error('INVALID_RETENTION_VALUE');
  }

  if (!['hour', 'day'].includes(retentionUnit)) {
    throw new Error('INVALID_RETENTION_UNIT');
  }

  return {
    retentionValue,
    retentionUnit,
  };
}

function subtractRetention(isoTime, retentionValue, retentionUnit) {
  const date = new Date(isoTime);

  if (Number.isNaN(date.getTime())) {
    throw new Error('INVALID_REFERENCE_TIME');
  }

  if (retentionUnit === 'hour') {
    date.setHours(date.getHours() - retentionValue);
  } else if (retentionUnit === 'day') {
    date.setDate(date.getDate() - retentionValue);
  }

  return date.toISOString();
}

function mapDomain(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    domain: row.domain,
    isActive: Boolean(row.is_active),
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port,
    serverIp: row.server_ip,
    mxHost: row.mx_host,
    note: row.note,
    dnsRecords: parseJsonArray(row.dns_records_json),
    setupNote: row.setup_note ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMailbox(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    domainId: row.domain_id,
    domain: row.domain,
    localPart: row.local_part,
    address: row.address,
    source: row.source,
    isActive: Boolean(row.is_active),
    retentionValue: row.retention_value ?? null,
    retentionUnit: row.retention_unit ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messageCount: row.message_count ?? 0,
    latestReceivedAt: row.latest_received_at ?? null,
  };
}

function mapMessage(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    mailboxId: row.mailbox_id,
    messageId: row.message_id,
    envelopeFrom: row.envelope_from,
    envelopeTo: row.envelope_to,
    fromName: row.from_name,
    fromAddress: row.from_address,
    subject: row.subject,
    text: row.text_content,
    html: row.html_content,
    receivedAt: row.received_at,
    rawSize: row.raw_size,
    attachmentCount: row.attachment_count,
    isRead: Boolean(row.is_read),
    address: row.address,
  };
}

function mapApiToken(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    tokenHash: row.token_hash,
    tokenPrefix: row.token_prefix,
    lastUsedAt: row.last_used_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function runInTransaction(callback) {
  db.exec('BEGIN');

  try {
    const result = callback();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function createDomain({
  domain,
  smtpHost = null,
  smtpPort = null,
  serverIp = null,
  mxHost = null,
  note = '',
  dnsRecords = [],
  setupNote = '',
}) {
  const now = timestamp();
  const normalizedDomain = normalizeDomain(domain);
  const { mailMxHost } = getMailDnsConfig();
  const normalizedServerIp = String(serverIp ?? '').trim() || null;
  const normalizedMxHost = mailMxHost || normalizeDnsTarget(mxHost) || null;
  const guidance = normalizeDnsGuidance(normalizedDomain, {
    dnsRecords,
    setupNote,
    smtpHost,
    serverIp: normalizedServerIp,
    mxHost: normalizedMxHost,
  });
  const payload = {
    id: `dom_${nanoid()}`,
    domain: normalizedDomain,
    is_active: 0,
    smtp_host: smtpHost,
    smtp_port: smtpPort,
    server_ip: normalizedServerIp,
    mx_host: normalizedMxHost,
    note,
    dns_records_json: JSON.stringify(guidance.dnsRecords),
    setup_note: guidance.setupNote,
    created_at: now,
    updated_at: now,
  };

  insertDomainStatement.run(payload);
  return getDomainById(payload.id);
}

export function listDomains() {
  return listDomainsStatement.all().map(mapDomain);
}

export function getDomainById(id) {
  return mapDomain(getDomainByIdStatement.get(id));
}

export function getDomainByName(domain) {
  return mapDomain(getDomainByNameStatement.get(normalizeDomain(domain)));
}

export function removeDomain(id) {
  return deleteDomainStatement.run(id).changes > 0;
}

export async function detectDomainDnsStatus(id) {
  const domain = getDomainById(id);

  if (!domain) {
    throw new Error('DOMAIN_NOT_FOUND');
  }

  const checkedAt = timestamp();
  const normalizedRequiredRecords = normalizeDnsRecords(domain.dnsRecords);
  const expectedMxRecords = normalizedRequiredRecords.filter((record) => record.type === 'MX');
  let resolvedMxRecords = [];
  let dnsLookupError = null;

  try {
    resolvedMxRecords = (await resolveMx(domain.domain)).map((record) => ({
      exchange: normalizeDnsTarget(record.exchange),
      priority: Number(record.priority),
    }));
  } catch (error) {
    dnsLookupError = error;
  }

  const requiredRecords = normalizedRequiredRecords.map((record) => {
    if (record.type !== 'MX') {
      return {
        ...record,
        expectedValue: record.value,
        matched: false,
        actualValue: null,
      };
    }

    const expectedValue = normalizeDnsTarget(record.value);
    const expectedPriority =
      record.priority !== undefined && record.priority !== null && record.priority !== ''
        ? Number(record.priority)
        : null;
    const matchedRecord = resolvedMxRecords.find((item) => (
      item.exchange === expectedValue &&
      (expectedPriority === null || item.priority === expectedPriority)
    ));

    return {
      ...record,
      expectedValue: record.value,
      matched: Boolean(matchedRecord),
      actualValue: matchedRecord ? `${matchedRecord.exchange} (priority ${matchedRecord.priority})` : null,
    };
  });

  const optionalRecords = buildOptionalDnsRecords(domain.domain).map((record) => ({
    ...record,
    expectedValue: record.value,
    matched: false,
    actualValue: null,
  }));

  const hasExpectedMx = expectedMxRecords.length > 0;
  const mxMatched = hasExpectedMx && expectedMxRecords.every((record) => (
    requiredRecords.some((item) => item.type === 'MX' && item.name === record.name && item.value === record.value && item.matched)
  ));
  const hasAnyResolvedMx = resolvedMxRecords.length > 0;
  const nextIsActive = mxMatched;

  if (Boolean(domain.isActive) !== nextIsActive) {
    updateDomainActiveStatusStatement.run({
      id,
      is_active: nextIsActive ? 1 : 0,
      updated_at: checkedAt,
    });
  }

  const actualMxSummary = hasAnyResolvedMx
    ? resolvedMxRecords.map((record) => `${record.exchange} (priority ${record.priority})`).join(', ')
    : null;

  let status = 'pending';
  let summary = '尚未检测到有效 MX 记录，域名暂不启用。';
  let nextStep = '请先为该域名添加 MX 记录，并等待 DNS 生效后重新检测。';

  if (mxMatched) {
    status = 'ready';
    summary = 'MX 记录检测成功，当前配置与系统要求一致，域名已启用并可用于收件。';
    nextStep = '现在可以创建邮箱并发送测试邮件。';
  } else if (dnsLookupError) {
    status = 'pending';
    summary = 'DNS 查询失败，暂时无法确认 MX 记录状态。';
    nextStep = '请确认域名可公开解析，稍后重新检测 DNS。';
  } else if (hasAnyResolvedMx) {
    status = 'mismatch';
    summary = '已检测到 MX 记录，但当前配置与系统要求不一致，域名暂不启用。';
    nextStep = '请将 MX 记录改为系统要求的主机和值一致后，再重新检测。';
  } else if (!hasExpectedMx) {
    status = 'pending';
    summary = '当前域名缺少系统期望的 MX 配置说明，暂无法完成自动校验。';
    nextStep = '请先补充该域名的 MX 指引配置后，再重新检测。';
  }

  return {
    domain: domain.domain,
    status,
    canEnable: mxMatched,
    isActive: nextIsActive,
    summary,
    nextStep,
    checkedAt,
    requiredRecords,
    optionalRecords,
    actualMxRecords: resolvedMxRecords,
    actualMxSummary,
    dnsLookupErrorCode: dnsLookupError?.code ?? null,
  };
}

export function generateRandomLocalPart(length = 10) {
  const safeLength = Number.isInteger(length) && length >= 6 ? length : 10;
  const timePart = Date.now().toString(36).slice(-4);
  const randomLength = Math.max(2, safeLength - timePart.length);
  return `m${timePart}${nanoid(randomLength)}`.slice(0, safeLength);
}

export function createMailbox({ domain, localPart, source = 'manual' }) {
  const matchedDomain = getDomainByName(domain);

  if (!matchedDomain) {
    throw new Error('DOMAIN_NOT_FOUND');
  }

  const normalizedLocalPart = localPart.trim().toLowerCase();
  const now = timestamp();
  const payload = {
    id: `mbx_${nanoid()}`,
    domain_id: matchedDomain.id,
    local_part: normalizedLocalPart,
    address: normalizeAddress(normalizedLocalPart, matchedDomain.domain),
    source,
    is_active: 1,
    retention_value: null,
    retention_unit: null,
    created_at: now,
    updated_at: now,
  };

  insertMailboxStatement.run(payload);
  return getMailboxById(payload.id);
}

export function listMailboxes() {
  return listMailboxesStatement.all().map(mapMailbox);
}

export function getMailboxById(id) {
  return mapMailbox(getMailboxByIdStatement.get(id));
}

export function getMailboxByAddress(address) {
  return mapMailbox(getMailboxByAddressStatement.get(normalizeMailboxAddress(address)));
}

export function removeMailbox(id) {
  return deleteMailboxStatement.run(id).changes > 0;
}

export function removeMailboxByAddress(address) {
  return deleteMailboxByAddressStatement.run(normalizeMailboxAddress(address)).changes > 0;
}

export function updateMailboxRetention(id, retention) {
  const mailbox = getMailboxById(id);

  if (!mailbox) {
    throw new Error('MAILBOX_NOT_FOUND');
  }

  const normalized = normalizeRetentionPolicy(retention);

  updateMailboxRetentionStatement.run({
    id,
    retention_value: normalized.retentionValue,
    retention_unit: normalized.retentionUnit,
    updated_at: timestamp(),
  });

  return getMailboxById(id);
}

export function updateMailboxRetentionByAddress(address, retention) {
  const mailbox = getMailboxByAddress(address);

  if (!mailbox) {
    throw new Error('MAILBOX_NOT_FOUND');
  }

  const normalized = normalizeRetentionPolicy(retention);

  updateMailboxRetentionByAddressStatement.run({
    address: mailbox.address,
    retention_value: normalized.retentionValue,
    retention_unit: normalized.retentionUnit,
    updated_at: timestamp(),
  });

  return getMailboxByAddress(mailbox.address);
}

export function saveIncomingMessage(message, attachments = []) {
  return runInTransaction(() => {
    insertMessageStatement.run(message);

    for (const attachment of attachments) {
      insertAttachmentStatement.run(attachment);
    }

    return getMessageById(message.id);
  });
}

export function listMessagesByMailbox(mailboxId) {
  return listMessagesByMailboxStatement.all(mailboxId).map((row) => ({
    id: row.id,
    messageId: row.message_id,
    envelopeFrom: row.envelope_from,
    envelopeTo: row.envelope_to,
    fromName: row.from_name,
    fromAddress: row.from_address,
    subject: row.subject,
    receivedAt: row.received_at,
    rawSize: row.raw_size,
    attachmentCount: row.attachment_count,
    isRead: Boolean(row.is_read),
  }));
}

export function listMessagesByMailboxAddress(address) {
  return listMessagesByMailboxAddressStatement.all(normalizeMailboxAddress(address)).map((row) => ({
    id: row.id,
    messageId: row.message_id,
    envelopeFrom: row.envelope_from,
    envelopeTo: row.envelope_to,
    fromName: row.from_name,
    fromAddress: row.from_address,
    subject: row.subject,
    receivedAt: row.received_at,
    rawSize: row.raw_size,
    attachmentCount: row.attachment_count,
    isRead: Boolean(row.is_read),
  }));
}

export function getMessageById(id) {
  const message = mapMessage(getMessageByIdStatement.get(id));

  if (!message) {
    return null;
  }

  return {
    ...message,
    attachments: listAttachmentsByMessageStatement.all(id).map((item) => ({
      id: item.id,
      filename: item.filename,
      contentType: item.content_type,
      size: item.size,
      contentId: item.content_id,
      checksum: item.checksum,
    })),
  };
}

export function markMessageAsRead(id) {
  markMessageReadStatement.run(id);
  return getMessageById(id);
}

export function removeMessage(id) {
  return deleteMessageStatement.run(id).changes > 0;
}

export function createApiToken({ id, name, tokenHash, tokenPrefix }) {
  const now = timestamp();
  insertApiTokenStatement.run({
    id,
    name: String(name ?? '').trim(),
    token_hash: tokenHash,
    token_prefix: tokenPrefix,
    last_used_at: null,
    created_at: now,
    updated_at: now,
  });

  return listApiTokens().find((item) => item.id === id) ?? null;
}

export function listApiTokens() {
  return listApiTokensStatement.all().map(mapApiToken);
}

export function getApiTokenByHash(tokenHash) {
  return mapApiToken(getApiTokenByHashStatement.get(tokenHash));
}

export function touchApiTokenLastUsedAt(id) {
  const now = timestamp();
  touchApiTokenLastUsedAtStatement.run({
    id,
    last_used_at: now,
    updated_at: now,
  });

  return listApiTokens().find((item) => item.id === id) ?? null;
}

export function removeApiToken(id) {
  return deleteApiTokenStatement.run(id).changes > 0;
}

export function purgeExpiredMessages(referenceTime = timestamp()) {
  let removedCount = 0;
  const mailboxes = listMailboxRetentionStatement.all();

  for (const mailbox of mailboxes) {
    const retentionValue = mailbox.retention_value;
    const retentionUnit = mailbox.retention_unit;

    if (!retentionValue || !retentionUnit) {
      continue;
    }

    const cutoffTime = subtractRetention(referenceTime, retentionValue, retentionUnit);
    removedCount += purgeExpiredMessagesByMailboxStatement.run(mailbox.id, cutoffTime).changes;
  }

  return removedCount;
}
