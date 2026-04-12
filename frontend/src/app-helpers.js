import React from 'react';
import dayjs from 'dayjs';
import { ApiOutlined, GlobalOutlined, InboxOutlined, MailOutlined } from '@ant-design/icons';

export function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

export function formatRelativeTime(value) {
  if (!value) {
    return '暂无记录';
  }

  const diffMinutes = dayjs().diff(dayjs(value), 'minute');

  if (diffMinutes < 1) {
    return '刚刚更新';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }

  const diffHours = dayjs().diff(dayjs(value), 'hour');

  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }

  return `${dayjs().diff(dayjs(value), 'day')} 天前`;
}

export function buildSummaryCards(stats, domains, mailboxes, messages) {
  return [
    {
      title: '已配置域名',
      value: domains.length,
      icon: React.createElement(GlobalOutlined),
      accent: 'summary-card-blue',
      helper: '当前域名数量',
    },
    {
      title: '活跃邮箱',
      value: mailboxes.length,
      icon: React.createElement(MailOutlined),
      accent: 'summary-card-purple',
      helper: '当前邮箱数量',
    },
    {
      title: '当前列表邮件',
      value: messages.length,
      icon: React.createElement(InboxOutlined),
      accent: 'summary-card-cyan',
      helper: '当前列表邮件',
    },
    {
      title: '数据库邮件总量',
      value: stats?.messages ?? 0,
      icon: React.createElement(ApiOutlined),
      accent: 'summary-card-gold',
      helper: '累计邮件总数',
    },
  ];
}

export function buildHealthItems(health, domains, mailboxes, messages) {
  const mailboxCoverage = domains.length ? Math.round((mailboxes.length / domains.length) * 100) : 0;
  const unreadCount = messages.filter((item) => !item.isRead).length;

  return [
    {
      label: '服务状态',
      value: health?.ok ? '在线' : '待连接',
      tone: health?.ok ? 'success' : 'processing',
      description: health?.service || 'domain-mail-backend',
    },
    {
      label: '域名覆盖',
      value: `${domains.length} / ${Math.max(domains.length, 1)}`,
      tone: domains.length ? 'processing' : 'default',
      description: domains.length ? '已具备收件配置' : '请先创建域名',
      progress: domains.length ? 100 : 12,
    },
    {
      label: '邮箱密度',
      value: `${mailboxes.length} 个`,
      tone: mailboxes.length ? 'processing' : 'warning',
      description: `${mailboxCoverage}% 域名覆盖率`,
      progress: Math.max(Math.min(mailboxCoverage, 100), 8),
    },
    {
      label: '待处理邮件',
      value: `${unreadCount} 封`,
      tone: unreadCount ? 'error' : 'success',
      description: unreadCount ? '存在未读邮件需要查看' : '所有邮件均已处理',
      progress: unreadCount ? Math.min(unreadCount * 15, 100) : 100,
    },
  ];
}

export function getRetentionLabel(mailbox) {
  if (!mailbox?.retentionValue || !mailbox?.retentionUnit) {
    return '已关闭';
  }

  return `${mailbox.retentionValue} ${mailbox.retentionUnit === 'day' ? '天' : '小时'}`;
}