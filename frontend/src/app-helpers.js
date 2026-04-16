import dayjs from 'dayjs';

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

export function getRetentionLabel(mailbox) {
  if (!mailbox?.retentionValue || !mailbox?.retentionUnit) {
    return '已关闭';
  }

  return `${mailbox.retentionValue} ${mailbox.retentionUnit === 'day' ? '天' : '小时'}`;
}