import React from 'react';
import { Form, Input, Modal, Typography } from 'antd';

const { Paragraph, Text } = Typography;

export default function DomainCreateModal({
  form,
  open,
  submitting,
  onCancel,
  onSubmit,
}) {
  return (
    <Modal
      title="添加域名"
      open={open}
      confirmLoading={submitting}
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onSubmit}
      >
        <Form.Item
          label="域名"
          name="domain"
          rules={[{ required: true, message: '请输入域名，例如 example.com' }]}
        >
          <Input placeholder="example.com" />
        </Form.Item>

        <div className="cloudflare-form-panel">
          <Text strong>Cloudflare 提示</Text>
          <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            如果你的域名 DNS 已经托管在 Cloudflare，这里不需要再次“接入 Cloudflare”。
            创建域名后，系统会告诉你还需要在 Cloudflare DNS 中配置哪些邮件记录。
          </Paragraph>
        </div>

        <Form.Item label="SMTP Host" name="smtpHost">
          <Input placeholder="可选，默认使用服务监听地址" />
        </Form.Item>

        <Form.Item label="SMTP Port" name="smtpPort">
          <Input placeholder="可选，默认 25/2525" />
        </Form.Item>

        <Form.Item label="备注" name="note">
          <Input.TextArea rows={3} placeholder="域名用途备注" />
        </Form.Item>

        <Form.Item label="Cloudflare 说明" name="setupNote">
          <Input.TextArea rows={3} placeholder="例如：域名 DNS 已在 Cloudflare，邮件相关记录需在 Cloudflare DNS 中补齐" />
        </Form.Item>
      </Form>
    </Modal>
  );
}