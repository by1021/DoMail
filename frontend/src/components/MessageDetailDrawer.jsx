import React from 'react';
import { Button, Card, Descriptions, Drawer, Empty, List, Popconfirm, Space } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

export default function MessageDetailDrawer({
  open,
  messageDetail,
  onClose,
  onDeleteMessage,
  formatDateTime,
}) {
  return (
    <Drawer
      title="邮件详情"
      width={760}
      open={open}
      onClose={onClose}
      extra={
        messageDetail ? (
          <Popconfirm title="确认删除这封邮件？" onConfirm={() => onDeleteMessage(messageDetail.id)}>
            <Button danger icon={<DeleteOutlined />}>
              删除邮件
            </Button>
          </Popconfirm>
        ) : null
      }
    >
      {messageDetail ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="主题">{messageDetail.subject || '(no subject)'}</Descriptions.Item>
            <Descriptions.Item label="发件人">
              {messageDetail.fromName
                ? `${messageDetail.fromName} <${messageDetail.fromAddress || '-'}>`
                : messageDetail.fromAddress || messageDetail.envelopeFrom || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="收件邮箱">{messageDetail.address}</Descriptions.Item>
            <Descriptions.Item label="Envelope To">{messageDetail.envelopeTo || '-'}</Descriptions.Item>
            <Descriptions.Item label="接收时间">
              {formatDateTime(messageDetail.receivedAt)}
            </Descriptions.Item>
            <Descriptions.Item label="原始大小">{messageDetail.rawSize || 0} bytes</Descriptions.Item>
            <Descriptions.Item label="附件数量">{messageDetail.attachmentCount}</Descriptions.Item>
          </Descriptions>

          <Card title="正文（Text）">
            <pre className="message-code-block">{messageDetail.text || '(empty)'}</pre>
          </Card>

          <Card title="HTML 预览源码">
            <pre className="message-code-block">{messageDetail.html || '(empty)'}</pre>
          </Card>

          <Card title="附件元数据">
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
      ) : (
        <Empty description="暂无邮件详情" />
      )}
    </Drawer>
  );
}