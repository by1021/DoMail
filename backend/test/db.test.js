import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function createTempWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'email-backend-db-'));
}

async function loadDbModule(tempDir) {
  const moduleUrl = new URL(`../src/db.js?workspace=${Date.now()}-${Math.random()}`, import.meta.url);
  const previousCwd = process.cwd();
  process.chdir(tempDir);

  try {
    return await import(moduleUrl.href);
  } finally {
    process.chdir(previousCwd);
  }
}

test('db module can create domain, mailbox and persist message details', async () => {
  const tempDir = createTempWorkspace();
  let dbModule;

  try {
    dbModule = await loadDbModule(tempDir);
    const domain = dbModule.createDomain({
      domain: 'Example.COM',
      smtpHost: 'smtp.example.com',
      smtpPort: 2525,
      note: 'primary',
    });

    assert.equal(domain.domain, 'example.com');
    assert.equal(domain.isActive, true);

    const mailbox = dbModule.createMailbox({
      domainId: domain.id,
      localPart: 'Inbox',
      source: 'manual',
    });

    assert.equal(mailbox.address, 'inbox@example.com');
    assert.equal(dbModule.listMailboxes().length, 1);

    const savedMessage = dbModule.saveIncomingMessage(
      {
        id: 'msg_001',
        mailbox_id: mailbox.id,
        message_id: '<message@example.com>',
        envelope_from: 'sender@example.net',
        envelope_to: mailbox.address,
        from_name: 'Sender',
        from_address: 'sender@example.net',
        subject: 'Test mail',
        text_content: 'hello text',
        html_content: '<p>hello text</p>',
        received_at: '2026-04-09T00:00:00.000Z',
        raw_size: 123,
        attachment_count: 1,
        is_read: 0,
      },
      [
        {
          id: 'att_001',
          message_id: 'msg_001',
          filename: 'hello.txt',
          content_type: 'text/plain',
          size: 5,
          content_id: null,
          checksum: 'abc123',
        },
      ],
    );

    assert.equal(savedMessage.id, 'msg_001');
    assert.equal(savedMessage.attachments.length, 1);
    assert.equal(savedMessage.attachments[0].filename, 'hello.txt');

    const listedMessages = dbModule.listMessagesByMailbox(mailbox.id);
    assert.equal(listedMessages.length, 1);
    assert.equal(listedMessages[0].subject, 'Test mail');
    assert.equal(listedMessages[0].isRead, false);

    const markedMessage = dbModule.markMessageAsRead('msg_001');
    assert.equal(markedMessage.isRead, true);

    const lookupMailbox = dbModule.getMailboxByAddress('INBOX@example.com');
    assert.equal(lookupMailbox?.id, mailbox.id);

  } finally {
    dbModule?.db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('db module enforces missing domain validation for mailbox creation', async () => {
  const tempDir = createTempWorkspace();
  let dbModule;

  try {
    dbModule = await loadDbModule(tempDir);

    assert.throws(
      () => {
        dbModule.createMailbox({
          domainId: 'missing-domain',
          localPart: 'test',
          source: 'manual',
        });
      },
      {
        message: 'DOMAIN_NOT_FOUND',
      },
    );

  } finally {
    dbModule?.db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('db module stores cloudflare dns guidance records for managed domains', async () => {
  const tempDir = createTempWorkspace();
  let dbModule;

  try {
    dbModule = await loadDbModule(tempDir);
    const domain = dbModule.createDomain({
      domain: 'Mail.Example.com',
      smtpHost: null,
      smtpPort: null,
      note: 'cloudflare domain',
      setupNote: '域名 DNS 已在 Cloudflare，仅需补齐邮件记录',
    });

    assert.equal(domain.domain, 'mail.example.com');
    assert.equal(domain.setupNote, '域名 DNS 已在 Cloudflare，仅需补齐邮件记录');
    assert.equal(Array.isArray(domain.dnsRecords), true);
    assert.equal(domain.dnsRecords.length >= 4, true);
    assert.equal(domain.dnsRecords.some((record) => record.type === 'MX'), true);
    assert.equal(domain.dnsRecords.some((record) => record.type === 'TXT' && String(record.value).includes('v=spf1')), true);
    assert.equal(domain.dnsRecords.some((record) => String(record.name).includes('_dmarc')), true);

    const listed = dbModule.listDomains();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].dnsRecords.length >= 4, true);

    const lookedUp = dbModule.getDomainById(domain.id);
    assert.equal(lookedUp.setupNote, '域名 DNS 已在 Cloudflare，仅需补齐邮件记录');
    assert.equal(lookedUp.dnsRecords[0].type, 'MX');
  } finally {
    dbModule?.db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('db module can update mailbox retention policy and remove message manually', async () => {
  const tempDir = createTempWorkspace();
  let dbModule;

  try {
    dbModule = await loadDbModule(tempDir);
    const domain = dbModule.createDomain({
      domain: 'example.com',
      smtpHost: 'smtp.example.com',
      smtpPort: 2525,
      note: 'primary',
    });

    const mailbox = dbModule.createMailbox({
      domainId: domain.id,
      localPart: 'cleanup',
      source: 'manual',
    });

    dbModule.saveIncomingMessage({
      id: 'msg_cleanup_1',
      mailbox_id: mailbox.id,
      message_id: '<cleanup-1@example.com>',
      envelope_from: 'sender@example.net',
      envelope_to: mailbox.address,
      from_name: 'Sender',
      from_address: 'sender@example.net',
      subject: 'Cleanup test',
      text_content: 'hello text',
      html_content: '<p>hello text</p>',
      received_at: '2026-04-09T00:00:00.000Z',
      raw_size: 123,
      attachment_count: 0,
      is_read: 0,
    });

    const updatedMailbox = dbModule.updateMailboxRetention(mailbox.id, {
      retentionValue: 24,
      retentionUnit: 'hour',
    });

    assert.equal(updatedMailbox.retentionValue, 24);
    assert.equal(updatedMailbox.retentionUnit, 'hour');

    const removed = dbModule.removeMessage('msg_cleanup_1');
    assert.equal(removed, true);
    assert.equal(dbModule.getMessageById('msg_cleanup_1'), null);
    assert.equal(dbModule.listMessagesByMailbox(mailbox.id).length, 0);
  } finally {
    dbModule?.db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('db module can purge expired messages by mailbox retention policy', async () => {
  const tempDir = createTempWorkspace();
  let dbModule;

  try {
    dbModule = await loadDbModule(tempDir);
    const domain = dbModule.createDomain({
      domain: 'example.com',
      smtpHost: 'smtp.example.com',
      smtpPort: 2525,
      note: 'primary',
    });

    const mailbox = dbModule.createMailbox({
      domainId: domain.id,
      localPart: 'retention',
      source: 'manual',
    });

    dbModule.updateMailboxRetention(mailbox.id, {
      retentionValue: 1,
      retentionUnit: 'day',
    });

    dbModule.saveIncomingMessage({
      id: 'msg_old',
      mailbox_id: mailbox.id,
      message_id: '<old@example.com>',
      envelope_from: 'sender@example.net',
      envelope_to: mailbox.address,
      from_name: 'Sender',
      from_address: 'sender@example.net',
      subject: 'Old mail',
      text_content: 'old',
      html_content: '<p>old</p>',
      received_at: '2026-04-08T00:00:00.000Z',
      raw_size: 100,
      attachment_count: 0,
      is_read: 0,
    });

    dbModule.saveIncomingMessage({
      id: 'msg_new',
      mailbox_id: mailbox.id,
      message_id: '<new@example.com>',
      envelope_from: 'sender@example.net',
      envelope_to: mailbox.address,
      from_name: 'Sender',
      from_address: 'sender@example.net',
      subject: 'New mail',
      text_content: 'new',
      html_content: '<p>new</p>',
      received_at: '2026-04-10T12:00:00.000Z',
      raw_size: 100,
      attachment_count: 0,
      is_read: 0,
    });

    const purgedCount = dbModule.purgeExpiredMessages('2026-04-10T12:30:00.000Z');

    assert.equal(purgedCount, 1);
    assert.equal(dbModule.getMessageById('msg_old'), null);
    assert.notEqual(dbModule.getMessageById('msg_new'), null);
    assert.equal(dbModule.listMessagesByMailbox(mailbox.id).length, 1);
  } finally {
    dbModule?.db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
