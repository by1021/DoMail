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
  getDomainDetail,
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
    expect(screen.getByText('先添加域名，再创建邮箱，最后进入邮件列表查看收件状态。')).toBeInTheDocument();
    expect(screen.getByText('已配置域名')).toBeInTheDocument();
    expect(screen.getByText('推荐流程')).toBeInTheDocument();
    expect(screen.getByText('下一步建议')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '全局搜索' })).toBeInTheDocument();
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
    expect(screen.getByText('随机生成邮箱')).toBeInTheDocument();
  });

  it('renders mailbox creation modal with preview flow', async () => {
    renderApp();

    await waitFor(() => {
      expect(screen.getByText('邮件控制台')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '创建邮箱' }));

    await waitFor(() => {
      expect(screen.getByText('创建流程')).toBeInTheDocument();
    });

    expect(screen.getByText('邮箱预览')).toBeInTheDocument();
    expect(screen.getByText('自定义模式：适合固定用途邮箱')).toBeInTheDocument();
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
    expect(screen.getByRole('spinbutton', { name: '自动清理时长' })).toHaveValue(24);
    expect(screen.getByRole('combobox', { name: '自动清理单位' })).toBeInTheDocument();
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
  it('shows generic dns guidance without forcing cloudflare-specific wording', async () => {
    getDomainDetail.mockResolvedValue({
      item: {
        id: 'domain-1',
        domain: 'example.com',
        note: '主域名',
        setupNote: '请先确认当前域名的 DNS 托管商，再把 MX、SPF、DKIM、DMARC 等记录补充到对应 DNS 面板中；MX 记录应指向你自己的收件主机。',
        smtpHost: 'mail.example.com',
        smtpPort: 25,
        dnsRecords: [
          {
            type: 'MX',
            name: '@',
            value: 'mail.example.com',
            priority: 10,
            status: 'pending',
            proxied: false,
            note: '接收 example.com 的入站邮件，MX 应指向你自己的收件主机',
          },
        ],
        createdAt: '2026-04-10T07:00:00.000Z',
        updatedAt: '2026-04-10T07:00:00.000Z',
        isActive: true,
      },
    });

    renderApp();

    await waitFor(() => {
      expect(screen.getByText('邮件控制台')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /添加域名/ }));

    await waitFor(() => {
      expect(screen.getByText('添加后再配置 DNS')).toBeInTheDocument();
    });

    expect(screen.getByText('系统会自动生成通用邮件记录建议')).toBeInTheDocument();
    expect(
      screen.getByText('无论你使用哪个 DNS 托管商，创建域名后都应按实际收件服务补充 MX、SPF、DKIM、DMARC 等记录。'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('radio', { name: '域名' }));

    await waitFor(() => {
      expect(screen.getByText('建议流程：添加域名 → 查看 DNS 指引 → 完成记录配置 → 创建邮箱')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /查看指引/ }));

    await waitFor(() => {
      expect(screen.getByText('下一步操作')).toBeInTheDocument();
    });

    expect(screen.getByText('这里展示的是通用 DNS 配置指引，不限定某个 DNS 服务商。')).toBeInTheDocument();
    expect(screen.getByText('请先确认当前域名的 DNS 托管位置，再到对应面板补充邮件记录。')).toBeInTheDocument();
    expect(screen.getByText('请把 MX、SPF、DKIM、DMARC 等记录补充到当前 DNS 托管商中，记录值应以你的收件服务为准。')).toBeInTheDocument();
    expect(screen.getByText('mail.example.com')).toBeInTheDocument();
    expect(screen.queryByText('route1.mx.cloudflare.net')).not.toBeInTheDocument();
    expect(screen.queryByText(/Cloudflare DNS 指引/)).not.toBeInTheDocument();
  });
});