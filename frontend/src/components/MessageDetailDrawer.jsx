import React from 'react';
import {
  Button,
  Card,
  Descriptions,
  Empty,
  List,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

export default function MessageDetailDrawer({
  messageDetail,
  onDeleteMessage,
  onBack = null,
  formatDateTime,
}) {
  if (!messageDetail) {
    return (
      <Card title="当前邮件详情" className="message-detail-panel">
        <Empty description="请选择一封邮件查看详情" />
      </Card>
    );
  }

  return (
    <Card
      title="当前邮件详情"
      className="message-detail-panel message-detail-panel-responsive message-detail-panel-mobile-friendly"
      extra={
        <Space wrap size={[8, 8]} className="message-detail-actions">
          {onBack ? <Button onClick={onBack}>返回列表</Button> : null}
          <Popconfirm title="确认删除这封邮件？" onConfirm={() => onDeleteMessage(messageDetail.id)}>
            <Button danger icon={<DeleteOutlined />}>
              删除邮件
            </Button>
          </Popconfirm>
        </Space>
      }
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card className="message-detail-hero message-detail-hero-responsive">
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Space wrap size={[8, 8]} className="message-detail-heading-group">
              <Title level={4} style={{ margin: 0 }}>
                {messageDetail.subject || '(no subject)'}
              </Title>
              <Tag color={messageDetail.isRead ? 'default' : 'blue'}>
                {messageDetail.isRead ? '已读' : '未读'}
              </Tag>
              <Tag color="purple">{messageDetail.attachmentCount || 0} 个附件</Tag>
            </Space>
            <Text type="secondary">
              发件人：
              {messageDetail.fromName
                ? `${messageDetail.fromName} <${messageDetail.fromAddress || '-'}>`
                : messageDetail.fromAddress || messageDetail.envelopeFrom || '-'}
            </Text>
            <Text type="secondary">接收时间：{formatDateTime(messageDetail.receivedAt)}</Text>
          </Space>
        </Card>

        <Card title="基础信息" className="message-detail-info-card">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="收件邮箱">{messageDetail.address}</Descriptions.Item>
            <Descriptions.Item label="Envelope To">{messageDetail.envelopeTo || '-'}</Descriptions.Item>
            <Descriptions.Item label="原始大小">{messageDetail.rawSize || 0} bytes</Descriptions.Item>
            <Descriptions.Item label="附件数量">{messageDetail.attachmentCount}</Descriptions.Item>
          </Descriptions>
        </Card>

        <div className="message-body-grid message-body-grid-responsive">
          <Card title="邮件正文" className="message-body-card message-body-card-responsive">
            {messageDetail.text ? (
              <div className="message-body-text message-body-text-responsive">
                {messageDetail.text.split(/\r?\n/).map((line, index) => (
                  <p key={`${index}-${line}`}>{line || '\u00A0'}</p>
                ))}
              </div>
            ) : (
              <Empty description="暂无纯文本正文" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>

          <Card title="HTML 预览" className="message-body-card message-body-card-responsive">
            {messageDetail.html ? (
              <div
                className="message-html-preview message-html-preview-responsive"
                dangerouslySetInnerHTML={{ __html: messageDetail.html }}
              />
            ) : (
              <Empty description="暂无 HTML 正文" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </div>

        <Card title="HTML 源码" className="message-detail-code-card">
          <pre className="message-code-block message-code-block-responsive">{messageDetail.html || '(empty)'}</pre>
        </Card>

        <Card title="附件元数据" className="message-detail-attachments-card">
          {messageDetail.attachments?.length ? (
            <List
              dataSource={messageDetail.attachments}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={item.filename || '(unnamed attachment)'}
                    description={`${item.contentType || '-'} · ${item.size || 0} bytes`}
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty description="无附件" />
          )}
        </Card>
      </Space>
    </Card>
  );
}