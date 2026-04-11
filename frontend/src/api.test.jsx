import { beforeEach, describe, expect, it, vi } from 'vitest';

const axiosCreate = vi.fn();

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
  });

  it('uses relative api base path by default for remote dev access', async () => {
    await import('./api.js');

    expect(axiosCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: '/api',
        timeout: 10000,
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
      }),
    );
  });
});