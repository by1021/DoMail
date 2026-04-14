import React from 'react';
import { Button, Card, Drawer, Empty, Space, Tag, Typography } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

function renderDnsRecordItem(record, index) {
  return (
    <div className="dns-record-item" key={`${record.type}-${record.name}-${index}`}>
      <div className="dns-record-head">
        <Space wrap>
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
      <Text type="secondary">{record.note || '无备注'}</Text>
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
  return (
    <Drawer
      title="域名设置详情"
      width={720}
      open={open}
      onClose={onClose}
      className="domain-detail-drawer"
    >
      {domainDetail ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }} className="domain-detail-content">
          <Card className="domain-detail-hero">
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <Space wrap>
                <Title level={4} style={{ margin: 0 }}>
                  {domainDetail.domain}
                </Title>
                <Tag color="blue">DNS 配置</Tag>
                <Tag color={domainDetail.dnsCheck?.status === 'ready' || domainDetail.isActive ? 'success' : 'default'}>
                  {domainDetail.dnsCheck?.status === 'ready' || domainDetail.isActive ? '已可继续创建邮箱' : '待完成 DNS 配置'}
                </Tag>
              </Space>

              <Text type="secondary">{domainDetail.setupNote || domainDetail.note || '暂无额外说明'}</Text>

              <div className="domain-detail-summary-grid">
                <div className="domain-detail-summary-item">
                  <Text type="secondary">当前状态</Text>
                  <Text strong>{domainDetail.dnsCheck?.status === 'ready' || domainDetail.isActive ? '已可收件' : '待补充 DNS 记录'}</Text>
                </div>
                <div className="domain-detail-summary-item">
                  <Text type="secondary">最小记录</Text>
                  <Text strong>{domainDetail.dnsRecords?.length || 0} 条</Text>
                </div>
                <div className="domain-detail-summary-item">
                  <Text type="secondary">MX 主机名</Text>
                  <Text strong>{domainDetail.mxHost || domainDetail.smtpHost || `mail.${domainDetail.domain}`}</Text>
                </div>
                <div className="domain-detail-summary-item">
                  <Text type="secondary">最近更新</Text>
                  <Text strong>{formatDateTime(domainDetail.updatedAt)}</Text>
                </div>
              </div>

              <div className="domain-detail-toolbar">
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

          <Card title="最小必需记录" extra={<Tag color="processing">{domainDetail.dnsRecords?.length || 0} 条</Tag>}>
            {domainDetail.dnsRecords?.length ? (
              <div className="dns-record-list">
                {domainDetail.dnsRecords.map((record, index) => renderDnsRecordItem(record, index))}
              </div>
            ) : (
              <Empty description="暂无 DNS 记录建议" />
            )}
          </Card>

          <Card title="补充说明">
            <Text type="secondary">
              {domainDetail.setupNote || '请先确认当前域名的 DNS 托管商，再把邮件记录按你的收件服务实际配置补充到对应面板。'}
            </Text>
          </Card>
        </Space>
      ) : (
        <Empty description="暂无域名详情" />
      )}
    </Drawer>
  );
}