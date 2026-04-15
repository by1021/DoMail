import React from 'react';
import { Avatar, Button, Card, Col, Empty, List, Progress, Row, Space, Statistic, Tag, Typography } from 'antd';
import MessagePreviewCard from './MessagePreviewCard.jsx';

const { Title, Paragraph, Text } = Typography;

export default function OverviewSection({
  filteredMessages,
  hasDomains,
  hasMailboxes,
  health,
  healthItems,
  latestDomain,
  latestMailbox,
  latestMessage,
  onCreateDomain,
  onCreateMailbox,
  onDeleteMessage,
  onOpenMessageDetail,
  onViewMessages,
  summaryCards,
  formatDateTime,
}) {
  const currentPhase = !hasDomains
    ? {
        label: '第 1 步',
        title: '先添加收件域名',
        description: '先创建域名并查看最小 DNS 指引，完成后再继续创建邮箱。',
        items: ['添加域名', '查看 DNS 指引', '完成基础配置'],
      }
    : !hasMailboxes
      ? {
          label: '第 2 步',
          title: '开始创建邮箱',
          description: '域名已就绪，建议先创建一个固定或随机邮箱，再进行投递验证。',
          items: ['创建固定邮箱', '或生成随机邮箱', '准备测试收件'],
        }
      : {
          label: '第 3 步',
          title: '查看最近收件',
          description: '邮箱已可用，下一步进入邮件列表查看最新收件与未读状态。',
          items: ['进入邮件列表', '查看未读邮件', '按需清理邮件'],
        };

  const nextStepItems = !hasDomains
    ? [
        { title: '添加收件域名', detail: '先创建一个域名，系统会给出最小 DNS 指引。' },
        { title: '核对 DNS 记录', detail: '优先完成最少必需记录，再继续创建邮箱。' },
        { title: '创建首个邮箱', detail: '域名准备完成后，再创建固定或随机邮箱。' },
      ]
    : !hasMailboxes
      ? [
          { title: '创建邮箱地址', detail: '可选择固定前缀，也可直接生成随机邮箱。' },
          { title: '发送测试邮件', detail: '创建完成后即可向邮箱投递，验证收件链路。' },
          { title: '进入邮件列表', detail: '确认邮件投递后，在列表中查看最近收件结果。' },
        ]
      : [
          { title: '查看最新收件', detail: '优先处理未读邮件，确认主题、发件人与送达时间。' },
          { title: '按需清理邮件', detail: '无用测试邮件可直接删除，保持列表整洁。' },
          { title: '持续验证链路', detail: '继续投递测试邮件，观察域名与邮箱的收件状态。' },
        ];

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Card className="hero-card">
        <Row gutter={[20, 20]} align="middle">
          <Col xs={24} xl={15}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <div>
                <Title level={2} style={{ margin: 0 }}>
                  收件概览
                </Title>
                <Paragraph className="hero-copy">
                  先添加域名，再创建邮箱，最后进入邮件列表查看收件状态。
                </Paragraph>
              </div>
              <Space wrap size={12}>
                <Button type="primary" onClick={onCreateDomain}>
                  添加域名
                </Button>
                <Button onClick={() => onCreateMailbox(false)} disabled={!hasDomains}>
                  创建邮箱
                </Button>
                <Button onClick={() => onCreateMailbox(true)} disabled={!hasDomains}>
                  随机邮箱
                </Button>
                <Button onClick={onViewMessages} disabled={!hasMailboxes}>
                  查看邮件
                </Button>
              </Space>
              {!hasDomains ? (
                <div className="hero-inline-tip">
                  <Text type="secondary">当前还没有域名，建议先完成域名添加，再继续创建邮箱。</Text>
                </div>
              ) : null}
            </Space>
          </Col>
          <Col xs={24} xl={9}>
            <div className="hero-side-card hero-phase-card">
              <Space direction="vertical" size={14} style={{ width: '100%' }}>
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  <Text className="hero-side-label">当前阶段</Text>
                  <Space align="center" wrap>
                    <Tag color="blue" className="hero-phase-tag">
                      {currentPhase.label}
                    </Tag>
                    <Text strong>{currentPhase.title}</Text>
                  </Space>
                  <Text type="secondary">{currentPhase.description}</Text>
                </Space>
                <List
                  split={false}
                  dataSource={currentPhase.items}
                  renderItem={(item) => <List.Item className="guide-item hero-phase-item">{item}</List.Item>}
                />
              </Space>
            </div>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        {summaryCards.map((item) => (
          <Col xs={24} sm={12} xl={6} key={item.title}>
            <Card className={`summary-card ${item.accent}`}>
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <div className="summary-card-head">
                  <div className="summary-card-icon">{item.icon}</div>
                  <Text type="secondary">{item.title}</Text>
                </div>
                <Statistic title={null} value={item.value} />
                <Text type="secondary">{item.helper}</Text>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="当前状态" extra={<Tag color={health?.ok ? 'success' : 'default'}>{health?.ok ? '在线' : '未连接'}</Tag>}>
            <Row gutter={[16, 16]}>
              {healthItems.slice(0, 3).map((item) => (
                <Col xs={24} md={12} key={item.label}>
                  <div className="health-item">
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <Space align="center" justify="space-between" style={{ width: '100%' }}>
                        <Text strong>{item.label}</Text>
                        <Tag color={item.tone}>{item.value}</Tag>
                      </Space>
                      <Text type="secondary">{item.description}</Text>
                      <Progress percent={item.progress ?? 0} size="small" showInfo={false} />
                    </Space>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card title="最近资源">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div className="resource-item">
                <div className="resource-item-head">
                  <Text type="secondary">最新域名</Text>
                  <Tag color="blue">Domain</Tag>
                </div>
                <Text strong>{latestDomain?.domain || '暂无域名'}</Text>
                <Text type="secondary">
                  {latestDomain ? latestDomain.note || '已创建，可继续查看 DNS 指引' : '先创建域名开始配置'}
                </Text>
              </div>
              <div className="resource-item">
                <div className="resource-item-head">
                  <Text type="secondary">最新邮箱</Text>
                  <Tag color="purple">Mailbox</Tag>
                </div>
                <Text strong>{latestMailbox?.address || '暂无邮箱'}</Text>
                <Text type="secondary">
                  {latestMailbox ? `来源：${latestMailbox.source}` : '创建域名后即可新增邮箱'}
                </Text>
              </div>
              <div className="resource-item">
                <div className="resource-item-head">
                  <Text type="secondary">最近邮件</Text>
                  <Tag color="cyan">Message</Tag>
                </div>
                <Text strong>{latestMessage?.subject || '暂无邮件'}</Text>
                <Text type="secondary">
                  {latestMessage
                    ? `${latestMessage.fromAddress || latestMessage.envelopeFrom || '-'} · ${formatDateTime(latestMessage.receivedAt)}`
                    : '创建邮箱并投递后可在这里查看最新收件'}
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card
            title="最近邮件"
            extra={
              <Button type="link" onClick={onViewMessages} disabled={!hasMailboxes}>
                查看全部
              </Button>
            }
          >
            {filteredMessages.length === 0 ? (
              <Empty description={hasMailboxes ? '当前还没有收件记录' : '请先创建邮箱，再等待收件'} />
            ) : (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {filteredMessages.slice(0, 3).map((item) => (
                  <MessagePreviewCard
                    key={item.id}
                    item={item}
                    onOpen={onOpenMessageDetail}
                    onDelete={onDeleteMessage}
                    formatDateTime={formatDateTime}
                  />
                ))}
              </Space>
            )}
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card title="下一步建议" extra={<Tag color="gold">Guide</Tag>}>
            <List
              split={false}
              dataSource={nextStepItems}
              renderItem={(item, index) => (
                <List.Item className="guide-item guide-check-item">
                  <Space align="start" size={12}>
                    <Avatar size={28} className="guide-avatar">
                      {index + 1}
                    </Avatar>
                    <div className="guide-check-copy">
                      <Text strong>{item.title}</Text>
                      <Text type="secondary">{item.detail}</Text>
                    </div>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}