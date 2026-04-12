import React from 'react';
import { Alert, Avatar, Card, Descriptions, Drawer, Empty, Space, Tag, Typography } from 'antd';

const { Title, Text } = Typography;

function buildDnsGuideSteps() {
  return [
    {
      title: '确认当前域名的 DNS 托管位置',
      desc: '请先确认当前域名的 DNS 托管位置，再到对应面板补充邮件记录。',
    },
    {
      title: '补充邮件记录并指向你的收件服务',
      desc: '请把 MX、SPF、DKIM、DMARC 等记录补充到当前 DNS 托管商中，记录值应以你的收件服务为准。',
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
                <Tag color="blue">DNS 配置指引</Tag>
                <Tag color={domainDetail.isActive ? 'success' : 'default'}>
                  {domainDetail.isActive ? '可继续创建邮箱' : '建议先完成配置'}
                </Tag>
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

          <Card title="下一步操作">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Alert
                type="info"
                showIcon
                message="先按步骤补充 DNS 记录，再创建邮箱做收件验证"
                description="这里展示的是通用 DNS 配置指引，不限定某个 DNS 服务商。"
              />
              {buildDnsGuideSteps().map((item, index) => (
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

          <Card title="DNS 记录建议" extra={<Tag color="processing">{domainDetail.dnsRecords?.length || 0} 条</Tag>}>
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

          <Card title="补充说明">
            <Space direction="vertical" size={8}>
              <Text type="secondary">
                {domainDetail.setupNote || '请先确认当前域名的 DNS 托管商，再把邮件记录按你的收件服务实际配置补充到对应面板。'}
              </Text>
              <Text type="secondary">
                如果你使用的是 Cloudflare，也是在 Cloudflare 的 DNS 面板中配置；如果使用其他 DNS 服务商，同样应在对应面板完成配置。
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