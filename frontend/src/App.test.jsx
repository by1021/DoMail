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
  detectDomainDns: vi.fn(),
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
  createDomain,
  deleteMessage,
  detectDomainDns,
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
    expect(actionBar?.querySelector('.admin-session-card')).not.toBeNull();
    expect(actionBar?.querySelector('.header-refresh-button')).not.toBeNull();
    expect(actionBar?.querySelector('.header-logout-button')).not.toBeNull();
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
    renderApp();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '概览' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '创建邮箱' }));

    await waitFor(() => {
      expect(screen.getByText('创建流程')).toBeInTheDocument();
    });

    expect(screen.getByText('邮箱预览')).toBeInTheDocument();
    expect(screen.getByText('自定义模式：适合固定用途邮箱')).toBeInTheDocument();
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

    renderApp();

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

  it('opens message detail drawer and marks unread message as read', async () => {
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
        text: 'plain text body',
        html: '<p>plain text body</p>',
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
        text: 'plain text body',
        html: '<p>plain text body</p>',
        attachments: [],
      },
    });

    renderApp();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '概览' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('邮件'));

    await waitFor(() => {
      expect(screen.getByText('当前邮箱概况')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /查看详情/ })[0]);

    await waitFor(() => {
      expect(screen.getByText('邮件详情')).toBeInTheDocument();
    });

    const drawer = document.querySelector('.ant-drawer');
    expect(drawer?.querySelector('.ant-drawer-content-wrapper')).not.toBeNull();

    expect(getMessageDetail).toHaveBeenCalledWith('message-1');
    expect(markMessageRead).toHaveBeenCalledWith('message-1');
    expect(screen.getAllByText('基础信息').length).toBeGreaterThan(0);
    expect(screen.getByText('正文')).toBeInTheDocument();
    expect(screen.getByText('HTML 源码')).toBeInTheDocument();
    expect(screen.getByText('plain text body')).toBeInTheDocument();
    expect(screen.getByText('无附件')).toBeInTheDocument();
  });
});