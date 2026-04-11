import path from 'node:path';
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

  CREATE INDEX IF NOT EXISTS idx_domains_domain ON domains(domain);
  CREATE INDEX IF NOT EXISTS idx_mailboxes_domain_id ON mailboxes(domain_id);
  CREATE INDEX IF NOT EXISTS idx_mailboxes_address ON mailboxes(address);
  CREATE INDEX IF NOT EXISTS idx_messages_mailbox_id ON messages(mailbox_id);
  CREATE INDEX IF NOT EXISTS idx_messages_received_at ON messages(received_at DESC);
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

const updateMailboxRetentionStatement = db.prepare(`
  UPDATE mailboxes
  SET retention_value = @retention_value,
      retention_unit = @retention_unit,
      updated_at = @updated_at
  WHERE id = @id
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

function buildDefaultDnsRecords(domain) {
  return [
    {
      type: 'MX',
      name: '@',
      value: 'route1.mx.cloudflare.net',
      priority: 10,
      status: 'pending',
      proxied: false,
      note: `接收 ${domain} 的入站邮件`,
    },
    {
      type: 'TXT',
      name: '@',
      value: 'v=spf1 include:_spf.mx.cloudflare.net ~all',
      status: 'pending',
      proxied: false,
      note: 'SPF 发信策略示例',
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

function normalizeCloudflareGuidance(domain, options = {}) {
  const dnsRecords = normalizeDnsRecords(options.dnsRecords)?.length
    ? normalizeDnsRecords(options.dnsRecords)
    : buildDefaultDnsRecords(domain);
  const setupNote = String(options.setupNote ?? '').trim();

  return {
    dnsRecords,
    setupNote,
  };
}

function normalizeAddress(localPart, domain) {
  return `${localPart.trim().toLowerCase()}@${normalizeDomain(domain)}`;
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
  note = '',
  dnsRecords = [],
  setupNote = '',
}) {
  const now = timestamp();
  const normalizedDomain = normalizeDomain(domain);
  const guidance = normalizeCloudflareGuidance(normalizedDomain, {
    dnsRecords,
    setupNote,
  });
  const payload = {
    id: `dom_${nanoid()}`,
    domain: normalizedDomain,
    is_active: 1,
    smtp_host: smtpHost,
    smtp_port: smtpPort,
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

export function generateRandomLocalPart(length = 10) {
  return nanoid(length);
}

export function createMailbox({ domainId, localPart, source = 'manual' }) {
  const domain = getDomainById(domainId);

  if (!domain) {
    throw new Error('DOMAIN_NOT_FOUND');
  }

  const normalizedLocalPart = localPart.trim().toLowerCase();
  const now = timestamp();
  const payload = {
    id: `mbx_${nanoid()}`,
    domain_id: domainId,
    local_part: normalizedLocalPart,
    address: normalizeAddress(normalizedLocalPart, domain.domain),
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
  return mapMailbox(getMailboxByAddressStatement.get(address.trim().toLowerCase()));
}

export function removeMailbox(id) {
  return deleteMailboxStatement.run(id).changes > 0;
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
