import React from 'react';
import { Button, Card, Popconfirm, Space, Tag, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

const { Text } = Typography;

export default function MessagePreviewCard({
  item,
  formatDateTime,
  onDelete,
  onOpen,
  confirmDelete = false,
}) {
  return (
    <Card className="message-preview-card message-preview-card-responsive" hoverable onClick={() => onOpen(item.id)}>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <div className="message-preview-header">
          <div className="message-preview-title-group">
            <div className="message-preview-title-row">
              <Text strong className="message-preview-subject">
                {item.subject || '(no subject)'}
              </Text>
              <Space wrap size={[8, 8]} className="message-preview-tags">
                {!item.isRead && <Tag color="blue">未读</Tag>}
                {item.attachmentCount > 0 && <Tag color="purple">{item.attachmentCount} 个附件</Tag>}
              </Space>
            </div>
            <Text type="secondary" className="message-preview-from">
              发件人：{item.fromAddress || item.envelopeFrom || '-'}
            </Text>
          </div>
          <Text type="secondary" className="message-preview-time">
            {formatDateTime(item.receivedAt)}
          </Text>
        </div>

        <div className="message-preview-meta">
          <Text type="secondary" className="message-preview-delivery">
            送达至：{item.envelopeTo || '-'}
          </Text>
        </div>

        <Space wrap className="message-preview-actions">
          <Text type="secondary">点击卡片查看详情</Text>
          {confirmDelete ? (
            <Popconfirm
              title="确认删除这封邮件？"
              onConfirm={(event) => {
                event?.stopPropagation?.();
                onDelete(item.id);
              }}
              onCancel={(event) => event?.stopPropagation?.()}
            >
              <Button
                danger
                type="link"
                icon={<DeleteOutlined />}
                style={{ paddingInline: 0 }}
                onClick={(event) => event.stopPropagation()}
              >
                删除邮件
              </Button>
            </Popconfirm>
          ) : (
            <Button
              danger
              type="link"
              icon={<DeleteOutlined />}
              style={{ paddingInline: 0 }}
              onClick={(event) => {
                event.stopPropagation();
                onDelete(item.id);
              }}
            >
              删除邮件
            </Button>
          )}
        </Space>
      </Space>
    </Card>
  );
}