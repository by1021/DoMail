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
          <Text strong>添加后再配置 DNS</Text>
          <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            这里只负责创建收件域名。创建完成后，系统会自动生成通用邮件记录建议与下一步配置指引。
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

        <div className="form-section-title">SMTP（可选）</div>
        <Alert
          type="info"
          showIcon
          className="form-inline-alert"
          message="不填写时将使用系统默认监听地址"
          description="仅在你需要手动指定 SMTP Host 或 Port 时再填写。"
        />

        <Form.Item label="SMTP Host" name="smtpHost">
          <Input placeholder="可选，默认使用服务监听地址" />
        </Form.Item>

        <Form.Item label="SMTP Port" name="smtpPort">
          <Input placeholder="可选，默认 25/2525" />
        </Form.Item>

        <Divider className="form-section-divider" />

        <div className="form-section-title">说明信息</div>
        <Alert
          type="warning"
          showIcon
          className="form-inline-alert"
          message="系统会自动生成通用邮件记录建议"
          description="无论你使用哪个 DNS 托管商，创建域名后都应按实际收件服务补充 MX、SPF、DKIM、DMARC 等记录。"
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