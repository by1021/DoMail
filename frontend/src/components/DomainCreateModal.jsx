import React from 'react';
import { Alert, Divider, Form, Input, Modal, Typography } from 'antd';

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
          <Text strong>先添加域名，系统会给出下一步配置建议</Text>
          <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            只需要填写域名；创建后系统会给出建议的 MX 配置，并可直接发起真实 DNS 检测。
          </Paragraph>
        </div>

        <div className="form-section-title">基础信息</div>
        <Form.Item
          label="域名"
          name="domain"
          rules={[{ required: true, message: '请输入域名，例如 example.com' }]}
        >
          <Input placeholder="example.com" />
        </Form.Item>

        <Form.Item label="用途备注" name="note">
          <Input.TextArea rows={3} placeholder="例如：官网收件、注册验证、临时测试域名" />
        </Form.Item>

        <Divider className="form-section-divider" />

        <div className="form-section-title">说明信息</div>
        <Alert
          type="warning"
          showIcon
          className="form-inline-alert"
          message="创建后可直接查看 DNS 建议和推荐操作。"
          description="无论你使用哪个 DNS 托管商，创建后都可以按系统给出的 MX 建议完成配置，并通过 DNS 检测确认是否与当前设置一致。"
        />

        <Form.Item label="补充说明（可选）" name="setupNote">
          <Input.TextArea
            rows={3}
            placeholder="例如：域名 DNS 托管在第三方平台，邮件记录仍需按实际收件服务配置"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}