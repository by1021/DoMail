import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import supertest from 'supertest';

function createTempWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'email-backend-auth-'));
}

async function loadAppModule(tempDir) {
  const moduleUrl = new URL(`../src/index.js?auth-test=${Date.now()}-${Math.random()}`, import.meta.url);
  const previousCwd = process.cwd();
  const previousEnv = {
    ADMIN_USERNAME: process.env.ADMIN_USERNAME,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    SESSION_SECRET: process.env.SESSION_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  };

  process.env.ADMIN_USERNAME = 'admin';
  process.env.ADMIN_PASSWORD = 'pass123456';
  process.env.SESSION_SECRET = 'test-session-secret';
  process.env.NODE_ENV = 'test';
  process.chdir(tempDir);

  try {
    const module = await import(moduleUrl.href);
    return {
      ...module,
      restoreEnv() {
        process.env.ADMIN_USERNAME = previousEnv.ADMIN_USERNAME;
        process.env.ADMIN_PASSWORD = previousEnv.ADMIN_PASSWORD;
        process.env.SESSION_SECRET = previousEnv.SESSION_SECRET;
        process.env.NODE_ENV = previousEnv.NODE_ENV;
      },
    };
  } finally {
    process.chdir(previousCwd);
  }
}

test('auth api rejects unauthenticated access to protected endpoints and allows login session flow', async () => {
  const tempDir = createTempWorkspace();
  let appModule;

  try {
    appModule = await loadAppModule(tempDir);
    const request = supertest.agent(appModule.createApp());

    const healthResponse = await request.get('/api/health');
    assert.equal(healthResponse.status, 200);
    assert.equal(healthResponse.body.ok, true);
    assert.equal(healthResponse.body.service, 'domain-mail-backend');

    const unauthenticatedDomains = await request.get('/api/domains');
    assert.equal(unauthenticatedDomains.status, 401);
    assert.equal(unauthenticatedDomains.body.ok, false);
    assert.equal(unauthenticatedDomains.body.error.code, 'AUTH_REQUIRED');

    const invalidLogin = await request.post('/api/auth/login').send({
      username: 'admin',
      password: 'wrong-password',
    });
    assert.equal(invalidLogin.status, 401);
    assert.equal(invalidLogin.body.ok, false);
    assert.equal(invalidLogin.body.error.code, 'INVALID_CREDENTIALS');

    const loginResponse = await request.post('/api/auth/login').send({
      username: 'admin',
      password: 'pass123456',
    });
    assert.equal(loginResponse.status, 200);
    assert.equal(loginResponse.body.ok, true);
    assert.equal(loginResponse.body.item.username, 'admin');

    const sessionResponse = await request.get('/api/auth/session');
    assert.equal(sessionResponse.status, 200);
    assert.equal(sessionResponse.body.ok, true);
    assert.equal(sessionResponse.body.item.username, 'admin');

    const authenticatedDomains = await request.get('/api/domains');
    assert.equal(authenticatedDomains.status, 200);
    assert.equal(authenticatedDomains.body.ok, true);
    assert.deepEqual(authenticatedDomains.body.items, []);

    const logoutResponse = await request.post('/api/auth/logout');
    assert.equal(logoutResponse.status, 200);
    assert.equal(logoutResponse.body.ok, true);

    const expiredSession = await request.get('/api/auth/session');
    assert.equal(expiredSession.status, 401);
    assert.equal(expiredSession.body.ok, false);
    assert.equal(expiredSession.body.error.code, 'AUTH_REQUIRED');

    const rejectedAfterLogout = await request.post('/api/domains').send({
      domain: 'example.com',
      serverIp: '203.0.113.10',
      mxHost: 'mx.example.com',
    });
    assert.equal(rejectedAfterLogout.status, 401);
    assert.equal(rejectedAfterLogout.body.ok, false);
    assert.equal(rejectedAfterLogout.body.error.code, 'AUTH_REQUIRED');

    process.env.MAIL_SERVER_IP = '203.0.113.10';
    process.env.MAIL_MX_HOST = 'mx.example.com';

    const reloginResponse = await request.post('/api/auth/login').send({
      username: 'admin',
      password: 'pass123456',
    });
    assert.equal(reloginResponse.status, 200);
    assert.equal(reloginResponse.body.ok, true);

    const createdDomain = await request.post('/api/domains').send({
      domain: 'example.com',
      serverIp: '203.0.113.20',
      mxHost: 'mx-ignored.example.com',
    });
    assert.equal(createdDomain.status, 201);
    assert.equal(createdDomain.body.ok, true);
    assert.equal(createdDomain.body.item.serverIp, '203.0.113.10');
    assert.equal(createdDomain.body.item.mxHost, 'mx.example.com');
    assert.equal(createdDomain.body.item.dnsRecords.length, 2);
    assert.equal(createdDomain.body.item.isActive, false);

    const detectResponse = await request.post(`/api/domains/${createdDomain.body.item.id}/detect-dns`);
    assert.equal(detectResponse.status, 200);
    assert.equal(detectResponse.body.ok, true);
    assert.equal(detectResponse.body.item.domain, 'example.com');
    assert.equal(detectResponse.body.item.status, 'ready');
    assert.equal(detectResponse.body.item.canEnable, true);
    assert.equal(detectResponse.body.item.isActive, true);
    assert.equal(Array.isArray(detectResponse.body.item.requiredRecords), true);
    assert.equal(detectResponse.body.item.requiredRecords.length, 2);
    assert.equal(Array.isArray(detectResponse.body.item.optionalRecords), true);
    assert.equal(typeof detectResponse.body.item.summary, 'string');
    assert.equal(typeof detectResponse.body.item.nextStep, 'string');
    assert.equal(typeof detectResponse.body.item.checkedAt, 'string');

    const mxRecord = detectResponse.body.item.requiredRecords.find((record) => record.type === 'MX');
    const aRecord = detectResponse.body.item.requiredRecords.find((record) => record.type === 'A');
    assert.ok(mxRecord);
    assert.ok(aRecord);
    assert.equal(mxRecord.expectedValue, 'mx.example.com');
    assert.equal(mxRecord.matched, true);
    assert.equal(mxRecord.actualValue, 'mx.example.com');
    assert.equal(aRecord.expectedValue, '203.0.113.10');
    assert.equal(aRecord.matched, false);
    assert.equal(aRecord.actualValue, null);
  } finally {
    appModule?.restoreEnv?.();
    appModule?.closeBackgroundServices?.();
    try {
      appModule?.db?.close?.();
    } catch {}
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('app creation fails fast when admin auth env is missing', async () => {
  const tempDir = createTempWorkspace();
  const moduleUrl = new URL(`../src/index.js?missing-env=${Date.now()}-${Math.random()}`, import.meta.url);
  const previousCwd = process.cwd();
  const previousEnv = {
    ADMIN_USERNAME: process.env.ADMIN_USERNAME,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    SESSION_SECRET: process.env.SESSION_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  };

  delete process.env.ADMIN_USERNAME;
  delete process.env.ADMIN_PASSWORD;
  delete process.env.SESSION_SECRET;
  process.env.NODE_ENV = 'test';
  process.chdir(tempDir);

  try {
    const appModule = await import(moduleUrl.href);

    assert.throws(
      () => appModule.createApp(),
      {
        message: /ADMIN_USERNAME|ADMIN_PASSWORD|SESSION_SECRET/,
      },
    );

    appModule?.closeBackgroundServices?.();
    try {
      appModule?.db?.close?.();
    } catch {}
  } finally {
    process.chdir(previousCwd);
    process.env.ADMIN_USERNAME = previousEnv.ADMIN_USERNAME;
    process.env.ADMIN_PASSWORD = previousEnv.ADMIN_PASSWORD;
    process.env.SESSION_SECRET = previousEnv.SESSION_SECRET;
    process.env.NODE_ENV = previousEnv.NODE_ENV;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('dns detect endpoint requires auth before exposing domain dns status', async () => {
  const tempDir = createTempWorkspace();
  let appModule;

  try {
    appModule = await loadAppModule(tempDir);
    const request = supertest(appModule.createApp());

    const detectResponse = await request.post('/api/domains/domain-1/detect-dns');
    assert.equal(detectResponse.status, 401);
    assert.equal(detectResponse.body.ok, false);
    assert.equal(detectResponse.body.error.code, 'AUTH_REQUIRED');
  } finally {
    appModule?.restoreEnv?.();
    appModule?.closeBackgroundServices?.();
    try {
      appModule?.db?.close?.();
    } catch {}
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});