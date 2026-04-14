import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConfigProvider, App as AntdApp } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

vi.mock('./api.js', () => ({
  createApiToken: vi.fn(),
  createDomain: vi.fn(),
  createMailbox: vi.fn(),
  deleteApiToken: vi.fn(),
  deleteDomain: vi.fn(),
  deleteMailbox: vi.fn(),
  deleteMessage: vi.fn(),
  detectDomainDns: vi.fn(),
  extractErrorMessage: vi.fn((error, fallback = '请求失败') => error?.message || fallback),
  getApiTokens: vi.fn(),
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
  createApiToken,
  createDomain,
  deleteApiToken,
  deleteMessage,
  detectDomainDns,
  getApiTokens,
  getDomainDetail,
  getDomains,
  getHealth,
  getMailboxMessages,
  getMailboxes,
  getMessageDetail,
  markMessageRead,
  updateMailboxRetention,
} from './api.js';

function renderApp(props = {}) {
  return render(
    <ConfigProvider>
      <AntdApp>
        <App {...props} />
      </AntdApp>
    </ConfigProvider>,
  );
}

describe('App', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.resetAllMocks();

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
    detectDomainDns.mockResolvedValue({
      ok: true,
      item: {
        domain: 'example.com',
        status: 'ready',
        summary: 'MX 记录检测成功，域名已启用并可用于收件。',
        nextStep: '现在可以创建邮箱并发送测试邮件。',
        checkedAt: '2026-04-10T07:05:00.000Z',
        canEnable: true,
        isActive: true,
        requiredRecords: [
          {
            type: 'MX',
            name: '@',
            expectedValue: 'mx.example.com',
            matched: true,
          },
          {
            type: 'A',
            name: 'mx',
            expectedValue: '203.0.113.10',
            matched: true,
          },
        ],
        optionalRecords: [
          {
            type: 'TXT',
            name: '@',
            expectedValue: 'v=spf1 mx ~all',
            matched: false,
          },
        ],
      },
    });

    getApiTokens.mockResolvedValue({
      items: [
        {
          id: 'tok_1',
          name: '默认只读 Token',
          tokenPrefix: 'dm_1234567890',
          lastUsedAt: null,
          createdAt: '2026-04-10T07:00:00.000Z',
          updatedAt: '2026-04-10T07:00:00.000Z',
        },
      ],
    });

    createApiToken.mockResolvedValue({
      ok: true,
      item: {
        id: 'tok_2',
        name: '收件机器人',
        tokenPrefix: 'dm_abcdef1234',
        token: 'dm_full_token_value_for_copy',
        lastUsedAt: null,
        createdAt: '2026-04-10T08:00:00.000Z',
        updatedAt: '2026-04-10T08:00:00.000Z',
      },
    });

    deleteApiToken.mockResolvedValue({ ok: true });
  });

  it('renders current section information instead of a shared console heading', async () => {
    renderApp();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '概览' })).toBeInTheDocument();
    });

    expect(screen.getByText('域名邮箱')).toBeInTheDocument();
    expect(screen.getAllByText('概览').length).toBeGreaterThan(0);
    expect(screen.getByText('查看整体收件状态与推荐操作')).toBeInTheDocument();
    expect(screen.queryByText('邮件控制台')).not.toBeInTheDocument();
    expect(screen.queryByText('集中查看域名、邮箱和邮件状态。')).not.toBeInTheDocument();
    expect(screen.getByText('先添加域名，再创建邮箱，最后进入邮件列表查看收件状态。')).toBeInTheDocument();
    expect(screen.getByText('已配置域名')).toBeInTheDocument();
    expect(screen.getByText('推荐流程')).toBeInTheDocument();
    expect(screen.getByText('下一步建议')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '全局搜索' })).toBeInTheDocument();
    expect(screen.getAllByText('hello@example.com').length).toBeGreaterThan(0);
  });

  it('renders beautified header actions for admin session controls', async () => {
    const handleLogout = vi.fn();

    const { container } = renderApp({
      adminProfile: {
        username: 'admin',
      },
      onLogout: handleLogout,
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '概览' })).toBeInTheDocument();
    });

    expect(screen.getByRole('textbox', { name: '全局搜索' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /刷新/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '退出登录' })).toBeInTheDocument();
    expect(screen.getByText('管理员')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();

    const actionBar = container.querySelector('.header-actions');
    expect(actionBar).not.toBeNull();
    expect(container.querySelector('.app-shell-responsive')).not.toBeNull();
    expect(container.querySelector('.app-main-layout')).not.toBeNull();
    expect(container.querySelector('.app-header-main')).not.toBeNull();
    expect(actionBar?.querySelector('.admin-session-card')).not.toBeNull();
    expect(actionBar?.querySelector('.header-refresh-button')).not.toBeNull();
    expect(actionBar?.querySelector('.header-logout-button')).not.toBeNull();
    expect(actionBar?.querySelector('.header-search-wrap')).not.toBeNull();
    expect(actionBar?.querySelector('.header-action-buttons')).not.toBeNull();
  });

  it('renders mailbox table after switching section', async () => {
    renderApp();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '概览' })).toBeInTheDocument();
    });

    const mailboxNav = screen.getByText('邮箱');
    fireEvent.click(mailboxNav);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '邮箱' })).toBeInTheDocument();
    });

    expect(screen.getByText('创建收件地址并查看邮箱容量')).toBeInTheDocument();
    expect(screen.getByText('邮箱管理')).toBeInTheDocument();
    expect(screen.getAllByText('hello@example.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('查看邮件').length).toBeGreaterThan(0);
    expect(screen.getByText('随机生成邮箱')).toBeInTheDocument();
  });

  it('renders simplified sidebar with brand and beautified navigation only', async () => {
    renderApp();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '概览' })).toBeInTheDocument();
    });

    expect(screen.getByText('域名邮箱')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: /segmented control/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /概览/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /域名/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /邮箱/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /邮件/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /API/ })).toBeInTheDocument();
    expect(screen.queryByText('快捷操作')).not.toBeInTheDocument();
    expect(screen.queryByText('当前栏目')).not.toBeInTheDocument();
    expect(screen.queryByText('概况')).not.toBeInTheDocument();
    expect(screen.queryByText('在线服务')).not.toBeInTheDocument();
  });

  it('supports switching sections from beautified sidebar navigation', async () => {
    renderApp();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '概览' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('邮箱'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '邮箱' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('邮件'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '邮件' })).toBeInTheDocument();
    });

    expect(screen.getByText('按邮箱查看邮件并快速处理未读内容')).toBeInTheDocument();
    expect(screen.getAllByText('邮件收件区').length).toBeGreaterThan(0);
    expect(screen.getByText('当前邮箱概况')).toBeInTheDocument();
    expect(screen.getByText('当前邮箱设置')).toBeInTheDocument();
  });

  it('keeps the selected sidebar navigation item accessible after section switching', async () => {
    renderApp();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '概览' })).toBeInTheDocument();
    });

    const overviewNav = screen.getByRole('radio', { name: /概览/ });
    const mailboxNav = screen.getByRole('radio', { name: /邮箱/ });
    const messageNav = screen.getByRole('radio', { name: /邮件/ });

    expect(overviewNav).toBeChecked();
    expect(mailboxNav).not.toBeChecked();

    fireEvent.click(mailboxNav);

    expect(mailboxNav).toBeChecked();
    expect(overviewNav).not.toBeChecked();

    await waitFor(() => {
      expect(screen.getByText('邮箱管理')).toBeInTheDocument();
    });

    fireEvent.click(messageNav);

    expect(messageNav).toBeChecked();
    expect(mailboxNav).not.toBeChecked();

    await waitFor(() => {
      expect(screen.getByText('当前邮箱概况')).toBeInTheDocument();
    });
  });

  it('renders mailbox creation modal with preview flow', async () => {
    const { container } = renderApp();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '概览' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '创建邮箱' }));

    await waitFor(() => {
      expect(screen.getByText('创建流程')).toBeInTheDocument();
    });

    expect(screen.getByText('邮箱预览')).toBeInTheDocument();
    expect(screen.getByText('自定义模式：适合固定用途邮箱')).toBeInTheDocument();
    expect(document.querySelector('.mailbox-create-modal')).not.toBeNull();
    expect(document.querySelector('.mailbox-create-form')).not.toBeNull();
  });

  it('renders simplified message workspace with mailbox summary and retention tools', async () => {
    renderApp();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '概览' })).toBeInTheDocument();
    });

    const messageNav = screen.getByText('邮件');
    fireEvent.click(messageNav);

    await waitFor(() => {
      expect(screen.getByText('当前邮箱概况')).toBeInTheDocument();
    });

    expect(screen.getAllByText('邮件收件区').length).toBeGreaterThan(0);
    expect(screen.getByText('当前邮箱设置')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '选择邮箱' })).toBeInTheDocument();
    expect(screen.getByText('当前 1 封邮件，未读 1 封。')).toBeInTheDocument();
    expect(screen.getByText('自动清理设置')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: '自动清理时长' })).toHaveValue(24);
    expect(screen.getByRole('combobox', { name: '自动清理单位' })).toBeInTheDocument();
  });

  it('switches sidebar navigation state immediately after clicking another item', async () => {
    renderApp();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '概览' })).toBeInTheDocument();
    });

    const overviewNav = screen.getByRole('radio', { name: /概览/ });
    const domainNav = screen.getByRole('radio', { name: /域名/ });

    expect(overviewNav).toBeChecked();
    expect(domainNav).not.toBeChecked();

    fireEvent.click(domainNav);

    expect(domainNav).toBeChecked();
    expect(overviewNav).not.toBeChecked();

    await waitFor(() => {
      expect(screen.getByText('域名管理')).toBeInTheDocument();
    });

    expect(screen.queryByText('域名概览')).not.toBeInTheDocument();
    expect(screen.queryByText('先看状态，再决定下一步操作。')).not.toBeInTheDocument();
    expect(screen.queryByText('主流程：添加域名 → 检测 DNS → 查看配置 → 创建邮箱')).not.toBeInTheDocument();
    expect(screen.queryByText('当前状态')).not.toBeInTheDocument();
    expect(screen.queryByText('下一步')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /添加域名/ })).toHaveLength(1);
    expect(screen.getByText('状态')).toBeInTheDocument();
    expect(screen.getByText('更新时间')).toBeInTheDocument();
    expect(screen.getByText('操作')).toBeInTheDocument();
  });

  it('keeps a single selected navigation item after switching sidebar items', async () => {
    const { container } = renderApp();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '概览' })).toBeInTheDocument();
    });

    expect(container.querySelectorAll('.section-segmented .ant-segmented-item-selected')).toHaveLength(1);
    expect(container.querySelectorAll('.section-segmented .nav-option-active')).toHaveLength(1);
    expect(screen.getByRole('radio', { name: /概览/ })).toBeChecked();

    fireEvent.click(screen.getByRole('radio', { name: /域名/ }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '域名' })).toBeInTheDocument();
    });

    expect(container.querySelectorAll('.section-segmented .ant-segmented-item-selected')).toHaveLength(1);
    expect(container.querySelectorAll('.section-segmented .nav-option-active')).toHaveLength(1);
    expect(screen.getByRole('radio', { name: /域名/ })).toBeChecked();

    fireEvent.click(screen.getByRole('radio', { name: /邮箱/ }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '邮箱' })).toBeInTheDocument();
    });

    expect(container.querySelectorAll('.section-segmented .ant-segmented-item-selected')).toHaveLength(1);
    expect(container.querySelectorAll('.section-segmented .nav-option-active')).toHaveLength(1);
    expect(screen.getByRole('radio', { name: /邮箱/ })).toBeChecked();
  });

  it('restores the overview navigation highlight after switching away and back again', async () => {
    const { container } = renderApp();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '概览' })).toBeInTheDocument();
    });

    const getNavOption = (name) =>
      screen.getByRole('radio', { name }).closest('.ant-segmented-item')?.querySelector('.nav-option');

    expect(getNavOption(/概览/)).toHaveClass('nav-option-active');

    fireEvent.click(screen.getByRole('radio', { name: /域名/ }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '域名' })).toBeInTheDocument();
    });

    expect(getNavOption(/域名/)).toHaveClass('nav-option-active');
    expect(getNavOption(/概览/)).not.toHaveClass('nav-option-active');

    fireEvent.click(screen.getByRole('radio', { name: /概览/ }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '概览' })).toBeInTheDocument();
    });

    expect(container.querySelectorAll('.section-segmented .nav-option-active')).toHaveLength(1);
    expect(getNavOption(/概览/)).toHaveClass('nav-option-active');
    expect(getNavOption(/域名/)).not.toHaveClass('nav-option-active');
  });

  it('submits mailbox retention setting and shows compact message actions in messages section', async () => {
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
      expect(screen.getByRole('heading', { name: '概览' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('邮件'));

    await waitFor(() => {
      expect(screen.getByText('当前邮箱设置')).toBeInTheDocument();
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
    expect(screen.getByText('当前 1 封邮件，未读 1 封。')).toBeInTheDocument();
    expect(screen.getByText('当前邮箱设置')).toBeInTheDocument();
  });
  it('shows simplified domain management flow and generic dns guidance', async () => {
    getDomainDetail.mockResolvedValue({
      item: {
        id: 'domain-1',
        domain: 'example.com',
        note: '主域名',
        setupNote: '请先确认当前域名的 DNS 托管商，再补充最小收件记录；最少只需完成 MX 和邮件主机解析。',
        smtpHost: 'mail.example.com',
        smtpPort: 25,
        serverIp: '203.0.113.10',
        mxHost: 'mx.example.com',
        dnsRecords: [
          {
            type: 'A',
            name: 'mx',
            value: '203.0.113.10',
            status: 'pending',
            proxied: false,
            note: '邮件主机需要有可解析的 A 记录，指向你的收件服务器 IP',
          },
          {
            type: 'MX',
            name: '@',
            value: 'mx.example.com',
            priority: 10,
            status: 'pending',
            proxied: false,
            note: '接收 example.com 的入站邮件，MX 应指向你自己的收件主机名',
          },
        ],
        createdAt: '2026-04-10T07:00:00.000Z',
        updatedAt: '2026-04-10T07:00:00.000Z',
        isActive: true,
      },
    });

    createDomain.mockResolvedValue({
      ok: true,
      item: {
        id: 'domain-2',
        domain: 'demo.example.com',
      },
    });

    const { container } = renderApp();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '概览' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /添加域名/ })[0]);

    await waitFor(() => {
      expect(screen.getByText('先添加域名，系统会给出下一步配置建议')).toBeInTheDocument();
    });

    expect(screen.getByText('只需要填写域名，邮件服务器 IP 与 MX 记录会由后端环境变量统一生成。')).toBeInTheDocument();
    expect(screen.queryByLabelText('服务器 IP（可选）')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('MX 主机名（可选）')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('SMTP Host')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('SMTP Port')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('example.com'), {
      target: { value: 'demo.example.com' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(createDomain).toHaveBeenCalledWith({
        domain: 'demo.example.com',
        smtpHost: null,
        smtpPort: null,
        note: '',
        setupNote: '',
      });
    });

    await waitFor(() => {
      expect(detectDomainDns).toHaveBeenCalledWith('domain-2');
    });

    fireEvent.click(screen.getByRole('radio', { name: /域名/ }));

    await waitFor(() => {
      expect(screen.getByText('域名管理')).toBeInTheDocument();
    });

    expect(container.querySelector('.domain-table-section')).not.toBeNull();
    expect(container.querySelector('.domain-table-card')).not.toBeNull();
    expect(screen.queryByText('域名概览')).not.toBeInTheDocument();
    expect(screen.queryByText('主流程：添加域名 → 检测 DNS → 查看配置 → 创建邮箱')).not.toBeInTheDocument();
    expect(screen.getByText('example.com')).toBeInTheDocument();
    expect(screen.getByText('状态')).toBeInTheDocument();
    expect(screen.getByText('更新时间')).toBeInTheDocument();
    expect(screen.getByText('操作')).toBeInTheDocument();
    expect(screen.getByText('检测 DNS')).toBeInTheDocument();
    expect(screen.queryByText('DNS 已基本可用，下一步可以直接创建邮箱验证收件。')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /查看配置/ }));

    await waitFor(() => {
      expect(screen.getByText('最小必需记录')).toBeInTheDocument();
    });

    expect(document.querySelector('.domain-detail-drawer')).not.toBeNull();
    expect(document.querySelector('.domain-detail-content')).not.toBeNull();
    expect(screen.queryByText('推荐下一步')).not.toBeInTheDocument();
    expect(screen.queryByText('可选增强记录')).not.toBeInTheDocument();
    expect(screen.queryByText('最近检测状态')).not.toBeInTheDocument();
    expect(screen.getByText('当前状态')).toBeInTheDocument();
    expect(screen.getAllByText('已可收件').length).toBeGreaterThan(0);
    expect(screen.getAllByText('请先确认当前域名的 DNS 托管商，再补充最小收件记录；最少只需完成 MX 和邮件主机解析。').length).toBeGreaterThan(0);
    expect(screen.getAllByText('203.0.113.10').length).toBeGreaterThan(0);
    expect(screen.getAllByText('mx.example.com').length).toBeGreaterThan(0);
    expect(screen.queryByText('route1.mx.cloudflare.net')).not.toBeInTheDocument();
    expect(screen.queryByText(/Cloudflare DNS 指引/)).not.toBeInTheDocument();
  });

  it(
    'auto refreshes mailbox messages in messages section so new mail appears without manual reload',
    async () => {
      getMailboxMessages
        .mockResolvedValueOnce({
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
        })
        .mockResolvedValue({
          items: [
            {
              id: 'message-2',
              subject: '新的实时邮件',
              isRead: false,
              attachmentCount: 0,
              fromAddress: 'notify@example.org',
              envelopeFrom: 'notify@example.org',
              envelopeTo: 'hello@example.com',
              receivedAt: '2026-04-10T07:05:00.000Z',
            },
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

      renderApp();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '概览' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('邮件'));

      await waitFor(() => {
        expect(screen.getByText('当前邮箱概况')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(getMailboxMessages.mock.calls.length).toBeGreaterThanOrEqual(2);
      });

      expect(getMailboxMessages).toHaveBeenLastCalledWith('mailbox-1');
      expect(screen.getByText('新的实时邮件')).toBeInTheDocument();
      expect(screen.getByText('当前 2 封邮件，未读 2 封。')).toBeInTheDocument();
    },
    10000,
  );

  it('opens message detail in a focused workspace and upgrades message body presentation', async () => {
    getMessageDetail.mockResolvedValue({
      item: {
        id: 'message-1',
        mailboxId: 'mailbox-1',
        subject: '欢迎使用',
        isRead: false,
        attachmentCount: 0,
        fromName: 'DoMail Team',
        fromAddress: 'team@example.org',
        envelopeFrom: 'team@example.org',
        envelopeTo: 'hello@example.com',
        address: 'hello@example.com',
        receivedAt: '2026-04-10T07:00:00.000Z',
        rawSize: 128,
        text: 'plain text body\nsecond line',
        html: '<p><strong>plain text body</strong></p><p>second line</p>',
        attachments: [],
      },
    });

    markMessageRead.mockResolvedValue({
      ok: true,
      item: {
        id: 'message-1',
        mailboxId: 'mailbox-1',
        subject: '欢迎使用',
        isRead: true,
        attachmentCount: 0,
        fromName: 'DoMail Team',
        fromAddress: 'team@example.org',
        envelopeFrom: 'team@example.org',
        envelopeTo: 'hello@example.com',
        address: 'hello@example.com',
        receivedAt: '2026-04-10T07:00:00.000Z',
        rawSize: 128,
        text: 'plain text body\nsecond line',
        html: '<p><strong>plain text body</strong></p><p>second line</p>',
        attachments: [],
      },
    });

    const { container } = renderApp();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '概览' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('邮件'));

    await waitFor(() => {
      expect(screen.getByText('当前邮箱概况')).toBeInTheDocument();
    });

    expect(screen.getByText('请选择一封邮件查看详情')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /查看详情/ })[0]);

    await waitFor(() => {
      expect(screen.getByText('当前邮件详情')).toBeInTheDocument();
    });

    expect(getMessageDetail).toHaveBeenCalledWith('message-1');
    expect(markMessageRead).toHaveBeenCalledWith('message-1');
    expect(screen.getAllByText('欢迎使用').length).toBeGreaterThan(0);
    expect(screen.getAllByText('基础信息').length).toBeGreaterThan(0);
    expect(screen.getByText('邮件正文')).toBeInTheDocument();
    expect(screen.getByText('HTML 预览')).toBeInTheDocument();
    expect(screen.getByText('HTML 源码')).toBeInTheDocument();
    expect(screen.getAllByText('plain text body').length).toBeGreaterThan(1);
    expect(screen.getAllByText('second line').length).toBeGreaterThan(0);
    expect(screen.getByText('无附件')).toBeInTheDocument();
    expect(screen.queryByText('当前邮箱概况')).not.toBeInTheDocument();
    expect(screen.queryByText('当前邮箱设置')).not.toBeInTheDocument();
    expect(container.querySelector('.message-detail-layout')).not.toBeNull();
    expect(container.querySelector('.message-detail-panel-responsive')).not.toBeNull();
    expect(container.querySelector('.message-html-preview')).not.toBeNull();
    expect(container.querySelector('.message-body-text')).not.toBeNull();
    expect(screen.getAllByText('邮件详情').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '返回列表' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: '返回邮件列表' })).not.toBeInTheDocument();
  });
  it('renders a compact api workspace with only core token and endpoint content', async () => {
    const { container } = renderApp();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '概览' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('radio', { name: /API/ }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'API' })).toBeInTheDocument();
    });

    expect(screen.getByText('创建 Bearer Token 并查询邮件列表与详情')).toBeInTheDocument();
    expect(screen.getAllByText('创建 Token').length).toBeGreaterThan(0);
    expect(screen.getByText('已有 Token')).toBeInTheDocument();
    expect(screen.getByText('默认只读 Token')).toBeInTheDocument();
    expect(screen.getByText('前缀：dm_1234567890')).toBeInTheDocument();
    expect(screen.getByText('核心接口')).toBeInTheDocument();
    expect(screen.getByText('Authorization: Bearer <token>')).toBeInTheDocument();
    expect(screen.getByText('GET /api/mailboxes/:mailboxId/messages')).toBeInTheDocument();
    expect(screen.getByText('GET /api/mailboxes/:mailboxId/messages?latest=1')).toBeInTheDocument();
    expect(screen.getByText('GET /api/messages/:messageId')).toBeInTheDocument();
    expect(container.querySelector('.api-compact-grid')).not.toBeNull();
    expect(container.querySelector('.api-endpoint-list')).not.toBeNull();

    expect(screen.queryByText('调用说明')).not.toBeInTheDocument();
    expect(screen.queryByText('mailboxId 是什么？')).not.toBeInTheDocument();
    expect(screen.queryByText('推荐调用顺序')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /查询全部邮件/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Token 名称' }), {
      target: { value: '收件机器人' },
    });
    fireEvent.click(screen.getByRole('button', { name: '创建 Token' }));

    await waitFor(() => {
      expect(createApiToken).toHaveBeenCalledWith({
        name: '收件机器人',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('新建 Token')).toBeInTheDocument();
    });

    expect(screen.getByText('收件机器人')).toBeInTheDocument();
    expect(screen.getByText('dm_full_token_value_for_copy')).toBeInTheDocument();
    expect(screen.getByText('请立即复制保存，该 Token 不会再次完整展示。')).toBeInTheDocument();
    expect(getApiTokens).toHaveBeenCalled();
  });

  it('deletes api token from compact api management section', async () => {
    renderApp();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '概览' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('radio', { name: /API/ }));

    await waitFor(() => {
      expect(screen.getByText('默认只读 Token')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /delete 删除/ }));

    await waitFor(() => {
      expect(screen.getByText('确认删除该 API Token？')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^OK$/i }));

    await waitFor(() => {
      expect(deleteApiToken).toHaveBeenCalledWith('tok_1');
    });
  });
});