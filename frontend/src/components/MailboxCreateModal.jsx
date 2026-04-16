import React from 'react';
import { Alert, Form, Input, Modal, Radio, Select, Space, Tag, Typography } from 'antd';

const { Paragraph, Text } = Typography;

function buildPreviewAddress(domain, localPart, random) {
  const normalizedDomain = String(domain ?? '').trim().toLowerCase();

  if (!normalizedDomain) {
    return '请先输入域名';
  }

  if (random) {
    return `系统将自动生成随机前缀 @ ${normalizedDomain}`;
  }

  if (!localPart) {
    return `请输入前缀，预览格式：prefix@${normalizedDomain}`;
  }

  return `${localPart}@${normalizedDomain}`;
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
      className="mailbox-create-modal"
    >
      <Form
        form={form}
        layout="vertical"
        className="mailbox-create-form"
        initialValues={{ random: false }}
        onFinish={onSubmit}
      >
        <div className="mailbox-form-panel">
          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            <Text strong>创建流程</Text>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              先选择一个已添加的域名，再决定使用自定义前缀还是随机前缀。创建完成后即可去收件列表查看邮件。
            </Paragraph>
          </Space>
        </div>

        <Form.Item
          label="所属域名"
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

        <Form.Item label="生成方式" name="random">
          <Radio.Group className="mailbox-mode-group">
            <Radio.Button value={false}>自定义前缀</Radio.Button>
            <Radio.Button value={true}>随机前缀</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item shouldUpdate noStyle>
          {({ getFieldValue }) => {
            const random = getFieldValue('random');
            const domain = getFieldValue('domain');
            const localPart = getFieldValue('localPart');

            return (
              <Space direction="vertical" size={14} style={{ width: '100%' }}>
                <Alert
                  type={random ? 'success' : 'info'}
                  showIcon
                  message={random ? '随机模式：适合临时收件场景' : '自定义模式：适合固定用途邮箱'}
                  description={
                    random
                      ? '系统会自动生成一个随机邮箱前缀，创建更快。'
                      : '你可以指定 support、sales、dev 等前缀，便于识别邮箱用途。'
                  }
                />

                {!random ? (
                  <Form.Item
                    label="邮箱前缀"
                    name="localPart"
                    rules={[{ required: true, message: '请输入邮箱前缀' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input placeholder="support / sales / dev" />
                  </Form.Item>
                ) : null}

                <div className="mailbox-preview-card">
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Space wrap>
                      <Text strong>邮箱预览</Text>
                      <Tag color={random ? 'green' : 'blue'}>
                        {random ? '随机前缀' : '自定义前缀'}
                      </Tag>
                    </Space>
                    <Text className="mailbox-preview-address">
                      {buildPreviewAddress(domain, localPart, random)}
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