import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConfigProvider, App as AntdApp } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

vi.mock('./api.js', () => ({
  createDomain: vi.fn(),
  createMailbox: vi.fn(),
  deleteDomain: vi.fn(),
  deleteMailbox: vi.fn(),
  deleteMessage: vi.fn(),
  extractErrorMessage: vi.fn((error, fallback = '请求失败') => error?.message || fallback),
  getDomainDetail: vi.fn(),
  getDomains: vi.fn(),
  getHealth: vi.fn(),
  getMailboxMessages: vi.fn(),
  getMailboxes: vi.fn(),
  getMessageDetail: vi.fn(),
  markMessageRead: vi.fn(),
  updateMailboxRetention: vi.fn(),
}));

import {
  deleteMessage,
  getDomains,
  getHealth,
  getMailboxMessages,
  getMailboxes,
  updateMailboxRetention,
} from './api.js';

function renderApp() {
  return render(
    <ConfigProvider>
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>,
  );
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getHealth.mockResolvedValue({
      ok: true,
      service: 'domain-mail-backend',
      timestamp: '2026-04-10T07:00:00.000Z',
      stats: {
        messages: 3,
      },
    });

    getDomains.mockResolvedValue({
      items: [
        {
          id: 'domain-1',
          domain: 'example.com',
          note: '主域名',
          smtpHost: 'smtp.example.com',
          smtpPort: 2525,
          dnsRecords: [],
          createdAt: '2026-04-10T07:00:00.000Z',
          updatedAt: '2026-04-10T07:00:00.000Z',
          isActive: true,
        },
      ],
    });

    getMailboxes.mockResolvedValue({
      items: [
        {
          id: 'mailbox-1',
          address: 'hello@example.com',
          domain: 'example.com',
          source: 'manual',
          retentionValue: 24,
          retentionUnit: 'hour',
          messageCount: 1,
          latestReceivedAt: '2026-04-10T07:00:00.000Z',
        },
      ],
    });

    getMailboxMessages.mockResolvedValue({
      items: [
        {
          id: 'message-1',
          subject: '欢迎使用',
          isRead: false,
          attachmentCount: 0,
          fromAddress: 'team@example.org',
          envelopeFrom: 'team@example.org',
          envelopeTo: 'hello@example.com',
          receivedAt: '2026-04-10T07:00:00.000Z',
        },
      ],
    });
  });

  it('renders simplified main console content without crashing', async () => {
    renderApp();

    await waitFor(() => {
      expect(screen.getByText('邮件控制台')).toBeInTheDocument();
    });

    expect(screen.getByText('域名邮箱')).toBeInTheDocument();
    expect(screen.getAllByText('概览').length).toBeGreaterThan(0);
    expect(screen.getByText('快速查看当前收件状态与最近内容。')).toBeInTheDocument();
    expect(screen.getByText('已配置域名')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索域名、邮箱、主题')).toBeInTheDocument();
    expect(screen.getAllByText('hello@example.com').length).toBeGreaterThan(0);
  });

  it('renders mailbox table after switching section', async () => {
    renderApp();

    await waitFor(() => {
      expect(screen.getByText('邮件控制台')).toBeInTheDocument();
    });

    const mailboxNav = screen.getByText('邮箱');
    fireEvent.click(mailboxNav);

    await waitFor(() => {
      expect(screen.getByText('邮箱管理')).toBeInTheDocument();
    });

    expect(screen.getAllByText('hello@example.com').length).toBeGreaterThan(0);
    expect(screen.getByText('查看邮件')).toBeInTheDocument();
  });

  it('renders mailbox retention setting in messages section', async () => {
    renderApp();

    await waitFor(() => {
      expect(screen.getByText('邮件控制台')).toBeInTheDocument();
    });

    const messageNav = screen.getByText('邮件');
    fireEvent.click(messageNav);

    await waitFor(() => {
      expect(screen.getByText('当前邮箱')).toBeInTheDocument();
    });

    expect(screen.getByText('自动清理设置')).toBeInTheDocument();
    expect(screen.getByDisplayValue('24')).toBeInTheDocument();
    expect(screen.getByText('小时')).toBeInTheDocument();
  });

  it('submits mailbox retention setting and shows delete action in messages section', async () => {
    updateMailboxRetention.mockResolvedValue({
      ok: true,
      item: {
        id: 'mailbox-1',
        retentionValue: 12,
        retentionUnit: 'hour',
      },
    });

    deleteMessage.mockResolvedValue({ ok: true });

    renderApp();

    await waitFor(() => {
      expect(screen.getByText('邮件控制台')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('邮件'));

    await waitFor(() => {
      expect(screen.getByText('自动清理设置')).toBeInTheDocument();
    });

    const retentionInput = screen.getByDisplayValue('24');
    fireEvent.change(retentionInput, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    await waitFor(() => {
      expect(updateMailboxRetention).toHaveBeenCalledWith('mailbox-1', {
        retentionValue: 12,
        retentionUnit: 'hour',
      });
    });

    expect(screen.getAllByText('删除邮件').length).toBeGreaterThan(0);
  });
});