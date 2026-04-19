import React from 'react';
import { Form, Input, Modal, Radio, Select, Space, Tag, Typography } from 'antd';

const { Text } = Typography;

function buildPreviewAddress(domain, localPart, random) {
  const normalizedDomain = String(domain ?? '').trim().toLowerCase();

  if (!normalizedDomain) {
    return '请先选择域名';
  }

  if (random) {
    return `随机前缀@${normalizedDomain}`;
  }

  if (!localPart) {
    return `prefix@${normalizedDomain}`;
  }

  return `${String(localPart).trim().toLowerCase()}@${normalizedDomain}`;
}

export default function MailboxCreateModal({
  form,
  open,
  submitting,
  domainOptions = [],
  onCancel,
  onSubmit,
}) {
  return (
    <Modal
      title="创建邮箱"
      open={open}
      forceRender
      confirmLoading={submitting}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText="创建邮箱"
      cancelText="取消"
      width={580}
      className="mailbox-create-modal mailbox-create-modal-responsive"
    >
      <Form
        form={form}
        layout="vertical"
        className="mailbox-create-form mailbox-create-form-responsive mailbox-create-form-compact"
        initialValues={{ random: false }}
        onFinish={onSubmit}
      >
        <div className="mailbox-create-section">
          <Form.Item
            label="选择主域名"
            name="domain"
            rules={[{ required: true, message: '请选择域名' }]}
          >
            <Select
              placeholder="请选择已添加的域名"
              options={domainOptions}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>

          <Form.Item label="邮箱前缀" name="random" style={{ marginBottom: 0 }}>
            <Radio.Group className="mailbox-mode-group mailbox-mode-group-responsive">
              <Radio.Button value={false}>自定义前缀</Radio.Button>
              <Radio.Button value={true}>随机前缀</Radio.Button>
            </Radio.Group>
          </Form.Item>
        </div>

        <Form.Item shouldUpdate noStyle>
          {({ getFieldValue }) => {
            const random = getFieldValue('random');
            const domain = getFieldValue('domain');
            const localPart = getFieldValue('localPart');

            return (
              <Space
                direction="vertical"
                size={12}
                style={{ width: '100%' }}
                className="mailbox-create-flow mailbox-create-flow-compact"
              >
                <div className="mailbox-create-compact-grid mailbox-create-compact-grid-tight">
                  {!random ? (
                    <Form.Item
                      label="邮箱前缀"
                      name="localPart"
                      rules={[
                        { required: true, message: '请输入邮箱前缀' },
                        {
                          pattern: /^[a-zA-Z0-9._-]+$/,
                          message: '仅支持字母、数字、点、下划线、中划线',
                        },
                      ]}
                      style={{ marginBottom: 0 }}
                    >
                      <Input placeholder="例如 support / sales / dev" />
                    </Form.Item>
                  ) : (
                    <div className="mailbox-create-static-field mailbox-create-static-field-compact">
                      <Text type="secondary">邮箱前缀</Text>
                      <Text strong>由系统自动生成</Text>
                    </div>
                  )}
                </div>

                <div className="mailbox-create-summary-card mailbox-create-summary-card-compact">
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <div className="mailbox-create-summary-head">
                      <Space wrap size={[6, 6]} className="mailbox-preview-head">
                        <Text strong>邮箱预览</Text>
                        <Tag color={random ? 'green' : 'blue'}>
                          {random ? '随机前缀' : '自定义前缀'}
                        </Tag>
                      </Space>
                    </div>

                    <Text className="mailbox-preview-address mailbox-preview-address-responsive">
                      {buildPreviewAddress(domain, localPart, random)}
                    </Text>

                    <Text type="secondary" className="mailbox-create-hint-text">
                      当前仅支持在已添加主域名下创建邮箱；创建成功后可立即前往收件区查看邮件。
                    </Text>
                  </Space>
                </div>
              </Space>
            );
          }}
        </Form.Item>
      </Form>
    </Modal>
  );
}