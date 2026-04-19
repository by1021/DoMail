import React from 'react';
import { Button, Card, Drawer, Empty, Space, Tag, Typography } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { getDomainStatusMeta } from '../app-view-helpers.js';

const { Title, Text } = Typography;

function renderDnsRecordItem(record, index) {
  return (
    <div className="dns-record-item dns-record-item-responsive" key={`${record.type}-${record.name}-${index}`}>
      <div className="dns-record-head dns-record-head-responsive">
        <Space wrap size={[6, 6]} className="dns-record-tag-group">
          <Tag color="blue">{record.type}</Tag>
          <Text strong>{record.name}</Text>
          {record.priority !== undefined ? <Tag color="purple">优先级 {record.priority}</Tag> : null}
          <Tag color={record.matched || record.status === 'active' ? 'success' : 'default'}>
            {record.matched || record.status === 'active' ? '已匹配' : (record.status || 'pending')}
          </Tag>
        </Space>
      </div>
      <Text code className="dns-record-value">
        {record.expectedValue || record.value}
      </Text>
      {record.type === 'MX' && record.expectedPriorityNote ? (
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {record.expectedPriorityNote}
        </Text>
      ) : null}
      {record.actualValue ? (
        <Text type="secondary">当前解析：{record.actualValue}</Text>
      ) : null}
      {record.note ? (
        <Text type="secondary">{record.note}</Text>
      ) : null}
    </div>
  );
}

export default function DomainDetailDrawer({
  open,
  domainDetail,
  onClose,
  onDetectDns,
  onCreateMailbox,
  formatDateTime,
}) {
  const statusMeta = domainDetail
    ? getDomainStatusMeta(domainDetail, domainDetail.dnsCheck)
    : null;

  return (
    <Drawer
      title="域名设置详情"
      width={720}
      open={open}
      onClose={onClose}
      className="domain-detail-drawer domain-detail-drawer-responsive"
    >
      {domainDetail ? (
        <Space
          direction="vertical"
          size={16}
          style={{ width: '100%' }}
          className="domain-detail-content domain-detail-content-responsive"
        >
          <Card className="domain-detail-hero">
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <Space wrap size={[8, 8]} className="domain-detail-heading-group">
                <Title level={4} style={{ margin: 0 }}>
                  {domainDetail.domain}
                </Title>
                <Tag color="blue">DNS 配置</Tag>
                <Tag color={statusMeta.color}>
                  {statusMeta.drawerStatusText}
                </Tag>
              </Space>

              <Text type="secondary">{domainDetail.setupNote || domainDetail.note || '暂无额外说明'}</Text>

              <div className="domain-detail-summary-grid domain-detail-summary-grid-responsive">
                <div className="domain-detail-summary-item domain-detail-summary-item-responsive">
                  <Text type="secondary">当前状态</Text>
                  <Text strong>{statusMeta.label}</Text>
                </div>
                <div className="domain-detail-summary-item domain-detail-summary-item-responsive">
                  <Text type="secondary">最小记录</Text>
                  <Text strong>{domainDetail.dnsRecords?.length || 0} 条</Text>
                </div>
                <div className="domain-detail-summary-item domain-detail-summary-item-responsive">
                  <Text type="secondary">MX 主机名</Text>
                  <Text strong>{domainDetail.mxHost || domainDetail.smtpHost || `mail.${domainDetail.domain}`}</Text>
                </div>
                <div className="domain-detail-summary-item domain-detail-summary-item-responsive">
                  <Text type="secondary">最近更新</Text>
                  <Text strong>{formatDateTime(domainDetail.updatedAt)}</Text>
                </div>
              </div>

              <div className="domain-detail-toolbar domain-detail-toolbar-responsive">
                <Button
                  type="primary"
                  ghost
                  icon={<ThunderboltOutlined />}
                  onClick={() => onDetectDns?.(domainDetail.id, { syncDetail: true })}
                >
                  检测 DNS
                </Button>
                <Button onClick={() => onCreateMailbox?.()}>
                  创建邮箱
                </Button>
              </div>
            </Space>
          </Card>

          <Card
            title="最小必需记录"
            className="domain-detail-records-card"
            extra={<Tag color="processing">{domainDetail.dnsRecords?.length || 0} 条</Tag>}
          >
            {domainDetail.dnsRecords?.length ? (
              <div className="dns-record-list dns-record-list-responsive">
                {domainDetail.dnsRecords.map((record, index) => renderDnsRecordItem(record, index))}
              </div>
            ) : (
              <Empty description="暂无 DNS 记录建议" />
            )}
          </Card>

          <Card title="补充说明" className="domain-detail-notes-card">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Text type="secondary">
                {domainDetail.dnsCheck?.summary || domainDetail.setupNote || statusMeta.summary}
              </Text>
              {domainDetail.dnsCheck?.actualMxSummary ? (
                <Text type="secondary">
                  当前检测到的 MX：{domainDetail.dnsCheck.actualMxSummary}
                </Text>
              ) : (
                <Text type="secondary">{statusMeta.detail}</Text>
              )}
              <Text type="secondary">
                {domainDetail.dnsCheck?.nextStep || statusMeta.nextStep}
              </Text>
            </Space>
          </Card>
        </Space>
      ) : (
        <Empty description="暂无域名详情" />
      )}
    </Drawer>
  );
}