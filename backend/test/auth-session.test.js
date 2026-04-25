import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.NODE_ENV = 'test';
process.env.ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-password';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';
process.env.SESSION_MAX_AGE_MS = process.env.SESSION_MAX_AGE_MS || '43200000';

const { createApp, db } = await import('../src/index.js');

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        server,
        port: address.port,
      });
    });

    server.on('error', reject);
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function requestJson({ port, method, path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const request = http.request(
      {
        hostname: '127.0.0.1',
        port,
        method,
        path,
        headers: {
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (response) => {
        const chunks = [];

        response.on('data', (chunk) => {
          chunks.push(chunk);
        });

        response.on('end', () => {
          const rawBody = Buffer.concat(chunks).toString('utf8');
          let data = null;

          if (rawBody) {
            try {
              data = JSON.parse(rawBody);
            } catch (error) {
              reject(error);
              return;
            }
          }

          resolve({
            status: response.statusCode,
            headers: response.headers,
            data,
          });
        });
      },
    );

    request.on('error', reject);

    if (payload) {
      request.write(payload);
    }

    request.end();
  });
}

function extractSessionCookie(setCookieHeader) {
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  const sessionCookie = cookies.find((cookie) => typeof cookie === 'string' && cookie.startsWith('domail.sid='));

  if (!sessionCookie) {
    return null;
  }

  return sessionCookie.split(';')[0];
}

function clearSessionsIfSupported() {
  try {
    db.exec('DELETE FROM sessions');
  } catch (error) {
    if (error?.code !== 'ERR_SQLITE_ERROR') {
      throw error;
    }
  }
}

test('管理员登录后的会话在服务重建后仍然可恢复', async () => {
  clearSessionsIfSupported();

  const firstRuntime = await listen(createApp());

  try {
    const loginResponse = await requestJson({
      port: firstRuntime.port,
      method: 'POST',
      path: '/api/auth/login',
      body: {
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD,
      },
    });

    assert.equal(loginResponse.status, 200);
    assert.equal(loginResponse.data?.ok, true);

    const sessionCookie = extractSessionCookie(loginResponse.headers['set-cookie']);
    assert.ok(sessionCookie, '登录成功后应返回 domail.sid Cookie');

    await closeServer(firstRuntime.server);

    const secondRuntime = await listen(createApp());

    try {
      const sessionResponse = await requestJson({
        port: secondRuntime.port,
        method: 'GET',
        path: '/api/auth/session',
        headers: {
          Cookie: sessionCookie,
        },
      });

      assert.equal(sessionResponse.status, 200);
      assert.equal(sessionResponse.data?.ok, true);
      assert.equal(sessionResponse.data?.item?.username, process.env.ADMIN_USERNAME);
    } finally {
      await closeServer(secondRuntime.server);
    }
  } finally {
    if (firstRuntime.server.listening) {
      await closeServer(firstRuntime.server);
    }
    clearSessionsIfSupported();
  }
});