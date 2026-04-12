import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConfigProvider, App as AntdApp } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuthApp from './AuthApp.jsx';

vi.mock('./api.js', () => ({
  loginAdmin: vi.fn(),
  logoutAdmin: vi.fn(),
  getAdminSession: vi.fn(),
  extractErrorMessage: vi.fn((error, fallback = '请求失败') => error?.message || fallback),
}));

vi.mock('./App.jsx', () => ({
  default: ({ adminProfile, onLogout }) => (
    <div>
      <div>管理后台</div>
      <div>{adminProfile?.username}</div>
      <button type="button" onClick={onLogout}>
        退出登录
      </button>
    </div>
  ),
}));

import { extractErrorMessage, getAdminSession, loginAdmin, logoutAdmin } from './api.js';

function renderAuthApp() {
  return render(
    <ConfigProvider>
      <AntdApp>
        <AuthApp />
      </AntdApp>
    </ConfigProvider>,
  );
}

describe('AuthApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminSession.mockRejectedValue({
      response: {
        status: 401,
        data: {
          error: {
            message: '请先登录管理账号',
          },
        },
      },
      message: 'Unauthorized',
    });
    loginAdmin.mockResolvedValue({
      ok: true,
      item: {
        username: 'admin',
      },
    });
    logoutAdmin.mockResolvedValue({ ok: true });
    extractErrorMessage.mockImplementation((error, fallback = '请求失败') => error?.message || fallback);
  });

  it('shows login page when session is not authenticated', async () => {
    renderAuthApp();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '管理员登录' })).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('请输入管理员账号')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入管理员密码')).toBeInTheDocument();
    expect(screen.queryByText('管理后台')).not.toBeInTheDocument();
  });

  it('shows app after existing session is restored', async () => {
    getAdminSession.mockResolvedValue({
      ok: true,
      item: {
        username: 'admin',
      },
    });

    renderAuthApp();

    await waitFor(() => {
      expect(screen.getByText('管理后台')).toBeInTheDocument();
    });

    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '管理员登录' })).not.toBeInTheDocument();
  });

  it('submits login form and switches to app view', async () => {
    renderAuthApp();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '管理员登录' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('请输入管理员账号'), {
      target: { value: 'admin' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入管理员密码'), {
      target: { value: 'pass123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: '登录管理后台' }));

    await waitFor(() => {
      expect(loginAdmin).toHaveBeenCalledWith({
        username: 'admin',
        password: 'pass123456',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('管理后台')).toBeInTheDocument();
    });
  });

  it('logs out and returns to login page', async () => {
    getAdminSession.mockResolvedValue({
      ok: true,
      item: {
        username: 'admin',
      },
    });

    renderAuthApp();

    await waitFor(() => {
      expect(screen.getByText('管理后台')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '退出登录' }));

    await waitFor(() => {
      expect(logoutAdmin).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '管理员登录' })).toBeInTheDocument();
    });
  });
});