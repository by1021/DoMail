import { beforeEach, describe, expect, it, vi } from 'vitest';

const axiosGet = vi.fn();
const axiosPost = vi.fn();
const axiosPatch = vi.fn();
const axiosDelete = vi.fn();
const axiosCreate = vi.fn(() => ({
  get: axiosGet,
  post: axiosPost,
  patch: axiosPatch,
  delete: axiosDelete,
}));

vi.mock('axios', () => ({
  default: {
    create: axiosCreate,
  },
}));

describe('api client configuration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete import.meta.env.VITE_API_BASE_URL;
    axiosGet.mockResolvedValue({ data: { ok: true } });
    axiosPost.mockResolvedValue({ data: { ok: true } });
    axiosPatch.mockResolvedValue({ data: { ok: true } });
    axiosDelete.mockResolvedValue({ data: { ok: true } });
  });

  it('uses relative api base path by default for remote dev access', async () => {
    await import('./api.js');

    expect(axiosCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: '/api',
        timeout: 10000,
        withCredentials: true,
      }),
    );
  });

  it('prefers configured VITE_API_BASE_URL when provided', async () => {
    import.meta.env.VITE_API_BASE_URL = 'http://example.com:3001';

    await import('./api.js');

    expect(axiosCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'http://example.com:3001',
        timeout: 10000,
        withCredentials: true,
      }),
    );
  });

  it('requests domain list without duplicating the api prefix', async () => {
    const { getDomains } = await import('./api.js');

    await getDomains();

    expect(axiosGet).toHaveBeenCalledWith('/domains');
  });

  it('requests admin session and login endpoints with auth paths', async () => {
    const { getAdminSession, loginAdmin, logoutAdmin } = await import('./api.js');

    await getAdminSession();
    await loginAdmin({ username: 'admin', password: 'pass123456' });
    await logoutAdmin();

    expect(axiosGet).toHaveBeenCalledWith('/auth/session');
    expect(axiosPost).toHaveBeenCalledWith('/auth/login', {
      username: 'admin',
      password: 'pass123456',
    });
    expect(axiosPost).toHaveBeenCalledWith('/auth/logout');
  });

  it('requests api token management endpoints without duplicating the api prefix', async () => {
    const { getApiTokens, createApiToken, deleteApiToken } = await import('./api.js');

    await getApiTokens();
    await createApiToken({ name: 'Read only token' });
    await deleteApiToken('tok_123');

    expect(axiosGet).toHaveBeenCalledWith('/tokens');
    expect(axiosPost).toHaveBeenCalledWith('/tokens', {
      name: 'Read only token',
    });
    expect(axiosDelete).toHaveBeenCalledWith('/tokens/tok_123');
  });
});