import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMailboxPreviewAddress,
  buildMailboxRequestPayload,
  getMailboxCreateInitialValues,
} from './mailbox-create-utils.js';

test('getMailboxCreateInitialValues returns default manual prefix + root domain mode', () => {
  assert.deepEqual(getMailboxCreateInitialValues(), {
    domain: undefined,
    prefixMode: 'custom',
    localPart: '',
    domainMode: 'root',
    subdomain: '',
  });
});

test('getMailboxCreateInitialValues merges overrides', () => {
  assert.deepEqual(
    getMailboxCreateInitialValues({
      domain: 'example.com',
      prefixMode: 'random',
      domainMode: 'random-subdomain',
    }),
    {
      domain: 'example.com',
      prefixMode: 'random',
      localPart: '',
      domainMode: 'random-subdomain',
      subdomain: '',
    },
  );
});

test('buildMailboxPreviewAddress returns hint when root domain is missing', () => {
  assert.equal(
    buildMailboxPreviewAddress({
      domain: '',
      prefixMode: 'custom',
      localPart: 'sales',
      domainMode: 'root',
      subdomain: '',
    }),
    '请先选择主域名',
  );
});

test('buildMailboxPreviewAddress builds custom prefix on root domain', () => {
  assert.equal(
    buildMailboxPreviewAddress({
      domain: 'Example.COM',
      prefixMode: 'custom',
      localPart: 'Sales.Team',
      domainMode: 'root',
      subdomain: '',
    }),
    'sales.team@example.com',
  );
});

test('buildMailboxPreviewAddress builds random prefix on root domain', () => {
  assert.equal(
    buildMailboxPreviewAddress({
      domain: 'example.com',
      prefixMode: 'random',
      localPart: '',
      domainMode: 'root',
      subdomain: '',
    }),
    '随机前缀@example.com',
  );
});

test('buildMailboxPreviewAddress builds custom subdomain preview', () => {
  assert.equal(
    buildMailboxPreviewAddress({
      domain: 'example.com',
      prefixMode: 'custom',
      localPart: 'dev',
      domainMode: 'custom-subdomain',
      subdomain: 'Inbox',
    }),
    'dev@inbox.example.com',
  );
});

test('buildMailboxPreviewAddress uses placeholder when custom subdomain label is empty', () => {
  assert.equal(
    buildMailboxPreviewAddress({
      domain: 'example.com',
      prefixMode: 'custom',
      localPart: 'dev',
      domainMode: 'custom-subdomain',
      subdomain: '',
    }),
    'dev@subdomain.example.com',
  );
});

test('buildMailboxPreviewAddress builds random subdomain preview', () => {
  assert.equal(
    buildMailboxPreviewAddress({
      domain: 'example.com',
      prefixMode: 'random',
      localPart: '',
      domainMode: 'random-subdomain',
      subdomain: '',
    }),
    '随机前缀@随机子域名.example.com',
  );
});

test('buildMailboxRequestPayload builds custom prefix on root domain payload', () => {
  assert.deepEqual(
    buildMailboxRequestPayload({
      domain: 'example.com',
      prefixMode: 'custom',
      localPart: 'ops',
      domainMode: 'root',
      subdomain: '',
    }),
    {
      domain: 'example.com',
      localPart: 'ops',
      random: false,
      randomSubdomain: false,
      subdomain: undefined,
    },
  );
});

test('buildMailboxRequestPayload builds random prefix with random subdomain payload', () => {
  assert.deepEqual(
    buildMailboxRequestPayload({
      domain: 'example.com',
      prefixMode: 'random',
      localPart: 'ignored',
      domainMode: 'random-subdomain',
      subdomain: '',
    }),
    {
      domain: 'example.com',
      localPart: undefined,
      random: true,
      randomSubdomain: true,
      subdomain: undefined,
    },
  );
});

test('buildMailboxRequestPayload normalizes custom subdomain payload', () => {
  assert.deepEqual(
    buildMailboxRequestPayload({
      domain: 'example.com',
      prefixMode: 'custom',
      localPart: 'team.box',
      domainMode: 'custom-subdomain',
      subdomain: 'MailHub',
    }),
    {
      domain: 'example.com',
      localPart: 'team.box',
      random: false,
      randomSubdomain: false,
      subdomain: 'mailhub',
    },
  );
});