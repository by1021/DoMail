import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSmtpSessionMeta,
  createRecipientValidationError,
  resolveRecipientDomainStatus,
} from '../src/smtp-utils.js';

test('resolveRecipientDomainStatus returns accepted for active domain', () => {
  const domain = {
    id: 'dom_1',
    domain: 'example.com',
    isActive: true,
  };

  assert.deepEqual(
    resolveRecipientDomainStatus({
      recipientAddress: 'user@example.com',
      domain,
    }),
    {
      ok: true,
      code: 'RCPT_ACCEPTED',
      message: 'Recipient domain accepted',
      recipient: 'user@example.com',
      domain: 'example.com',
    },
  );
});

test('resolveRecipientDomainStatus rejects missing domain', () => {
  assert.deepEqual(
    resolveRecipientDomainStatus({
      recipientAddress: 'user@example.com',
      domain: null,
    }),
    {
      ok: false,
      code: 'DOMAIN_NOT_CONFIGURED',
      message: 'Recipient domain is not configured or inactive',
      recipient: 'user@example.com',
      domain: 'example.com',
    },
  );
});

test('resolveRecipientDomainStatus rejects inactive domain', () => {
  const domain = {
    id: 'dom_2',
    domain: 'example.com',
    isActive: false,
  };

  assert.deepEqual(
    resolveRecipientDomainStatus({
      recipientAddress: 'user@example.com',
      domain,
    }),
    {
      ok: false,
      code: 'DOMAIN_NOT_CONFIGURED',
      message: 'Recipient domain is not configured or inactive',
      recipient: 'user@example.com',
      domain: 'example.com',
    },
  );
});

test('createRecipientValidationError exposes SMTP response code and machine-readable cause', () => {
  const error = createRecipientValidationError({
    recipientAddress: 'user@example.com',
  });

  assert.equal(error.message, 'Domain not configured');
  assert.equal(error.responseCode, 550);
  assert.equal(error.smtpCode, 'DOMAIN_NOT_CONFIGURED');
  assert.equal(error.recipient, 'user@example.com');
});

test('buildSmtpSessionMeta extracts envelope information for logging', () => {
  assert.deepEqual(
    buildSmtpSessionMeta({
      session: {
        remoteAddress: '203.0.113.8',
        hostNameAppearsAs: 'mx.sender.net',
        envelope: {
          mailFrom: {
            address: 'sender@example.net',
          },
          rcptTo: [
            {
              address: 'user@example.com',
            },
          ],
        },
      },
    }),
    {
      remoteAddress: '203.0.113.8',
      clientHostname: 'mx.sender.net',
      mailFrom: 'sender@example.net',
      rcptTo: ['user@example.com'],
    },
  );
});

test('buildSmtpSessionMeta falls back safely when envelope is incomplete', () => {
  assert.deepEqual(
    buildSmtpSessionMeta({
      session: {
        remoteAddress: null,
        hostNameAppearsAs: '',
        envelope: {},
      },
    }),
    {
      remoteAddress: 'unknown',
      clientHostname: 'unknown',
      mailFrom: null,
      rcptTo: [],
    },
  );
});