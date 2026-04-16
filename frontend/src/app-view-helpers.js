export function normalizeSearchKeyword(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function filterByKeyword(items, keyword, matcher) {
  if (!keyword) {
    return items;
  }

  return items.filter((item) => matcher(item, keyword));
}

export function getDomainStatusMeta(record, dnsStatus) {
  if (dnsStatus?.status === 'ready') {
    return {
      label: '已可收件',
      color: 'success',
      summary: dnsStatus.summary || '最小收件记录已齐全，域名已可用于收件。',
      nextStep: dnsStatus.nextStep || '现在可以创建邮箱并发送测试邮件。',
      detail: '检测已确认 MX 记录与系统要求一致。',
      drawerStatusText: '已可继续创建邮箱',
    };
  }

  if (dnsStatus?.status === 'mismatch') {
    return {
      label: 'MX 不一致',
      color: 'warning',
      summary: dnsStatus.summary || '已检测到 MX 记录，但当前配置与系统要求不一致。',
      nextStep: dnsStatus.nextStep || '请调整 MX 指向后重新检测 DNS。',
      detail: dnsStatus.actualMxSummary
        ? `当前解析到：${dnsStatus.actualMxSummary}`
        : '请核对当前域名的 MX 指向是否正确。',
      drawerStatusText: 'MX 与系统要求不一致',
    };
  }

  if (record?.isActive) {
    return {
      label: '已可收件',
      color: 'success',
      summary: 'DNS 已基本可用，下一步可以直接创建邮箱验证收件。',
      nextStep: '创建一个邮箱并投递测试邮件',
      detail: '当前域名已处于可收件状态。',
      drawerStatusText: '已可继续创建邮箱',
    };
  }

  return {
    label: '待完成配置',
    color: 'default',
    summary: dnsStatus?.summary || '域名已添加，但还需要先核对并补充最小 DNS 记录。',
    nextStep: dnsStatus?.nextStep || '先检测 DNS，再按建议补充记录',
    detail: dnsStatus?.actualMxSummary
      ? `当前解析到：${dnsStatus.actualMxSummary}`
      : `最少 ${record?.dnsRecords?.length || 0} 条必需记录，建议先完成后再创建邮箱。`,
    drawerStatusText: '待完成 DNS 配置',
  };
}