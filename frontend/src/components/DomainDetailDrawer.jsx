import React from 'react';
import { Avatar, Card, Descriptions, Drawer, Empty, Space, Tag, Typography } from 'antd';

const { Title, Text } = Typography;

function buildCloudflareGuideSteps() {
  return [
    {
      title: '确认域名已在 Cloudflare 托管',
      desc: '如果你的域名 DNS 已经托管在 Cloudflare，无需再次接入或切换托管商。',
    },
    {
      title: '在 Cloudflare DNS 页面补充邮件记录',
      desc: '根据下方清单配置 MX、SPF、DKIM、DMARC 等记录，注意邮件相关记录不要误开代理。',
    },
    {
      title: '等待 DNS 生效后验证收件',
      desc: '记录生效后，为该域名创建邮箱并投递测试邮件，验证 SMTP 收件链路。',
    },
  ];
}

export default function DomainDetailDrawer({
  open,
  domainDetail,
  onClose,
  formatDateTime,
}) {
  return (
    <Drawer
      title="域名设置详情"
      width={720}
      open={open}
      onClose={onClose}
    >
      {domainDetail ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card className="domain-detail-hero">
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Space wrap>
                <Title level={4} style={{ margin: 0 }}>
                  {domainDetail.domain}
                </Title>
                <Tag color="blue">Cloudflare DNS 指引</Tag>
              </Space>
              <Text type="secondary">{domainDetail.setupNote || domainDetail.note || '暂无额外说明'}</Text>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="最近更新">{formatDateTime(domainDetail.updatedAt)}</Descriptions.Item>
                <Descriptions.Item label="建议记录数">{domainDetail.dnsRecords?.length || 0}</Descriptions.Item>
                <Descriptions.Item label="SMTP">
                  {domainDetail.smtpHost ? `${domainDetail.smtpHost}:${domainDetail.smtpPort || 25}` : '0.0.0.0:2525'}
                </Descriptions.Item>
              </Descriptions>
            </Space>
          </Card>

          <Card title="Cloudflare 中需要做什么">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {buildCloudflareGuideSteps().map((item, index) => (
                <div className="setup-step-card" key={`${item.title}-${index}`}>
                  <Space align="start">
                    <Avatar size={28} className="setup-step-avatar">
                      {index + 1}
                    </Avatar>
                    <Space direction="vertical" size={2}>
                      <Text strong>{item.title}</Text>
                      <Text type="secondary">{item.desc}</Text>
                    </Space>
                  </Space>
                </div>
              ))}
            </Space>
          </Card>

          <Card title="说明">
            <Text type="secondary">
              这里展示的是“你的域名已经在 Cloudflare 托管时，还需要在 Cloudflare DNS 页面中补充哪些邮件记录”，不是再次托管或接入 Cloudflare。
            </Text>
          </Card>

          <Card title="DNS 记录建议">
            {domainDetail.dnsRecords?.length ? (
              <div className="dns-record-list">
                {domainDetail.dnsRecords.map((record, index) => (
                  <div className="dns-record-item" key={`${record.type}-${record.name}-${index}`}>
                    <div className="dns-record-head">
                      <Space wrap>
                        <Tag color="blue">{record.type}</Tag>
                        <Text strong>{record.name}</Text>
                        {record.priority !== undefined ? <Tag color="purple">优先级 {record.priority}</Tag> : null}
                        <Tag color={record.status === 'active' ? 'success' : 'default'}>
                          {record.status || 'pending'}
                        </Tag>
                      </Space>
                    </div>
                    <Text code className="dns-record-value">
                      {record.value}
                    </Text>
                    <Text type="secondary">{record.note || '无备注'}</Text>
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="暂无 DNS 记录建议" />
            )}
          </Card>
        </Space>
      ) : (
        <Empty description="暂无域名详情" />
      )}
    </Drawer>
  );
}