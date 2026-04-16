import React from 'react';
import { Form, Input, Modal, Typography } from 'antd';

const { Text } = Typography;

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
      forceRender
      confirmLoading={submitting}
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onSubmit}
      >
        <div className="cloudflare-form-panel">
          <Text strong>只需填写域名，创建后即可查看 DNS 配置建议并检测。</Text>
        </div>

        <Form.Item
          label="域名"
          name="domain"
          rules={[{ required: true, message: '请输入域名，例如 example.com' }]}
        >
          <Input placeholder="example.com" />
        </Form.Item>

        <Form.Item label="备注（可选）" name="note">
          <Input placeholder="例如：官网收件或测试域名" />
        </Form.Item>
      </Form>
    </Modal>
  );
}