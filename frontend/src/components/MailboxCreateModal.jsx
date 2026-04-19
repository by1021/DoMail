import React from 'react';
import { Form, Input, Modal, Radio, Select, Space, Typography } from 'antd';
import {
  buildMailboxPreviewAddress,
  DOMAIN_MODE_CUSTOM_SUBDOMAIN,
  MAILBOX_DOMAIN_MODES,
  MAILBOX_PREFIX_MODES,
  PREFIX_MODE_CUSTOM,
  PREFIX_MODE_RANDOM,
} from '../mailbox-create-utils.js';

const { Text } = Typography;

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
      centered
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
        initialValues={{
          prefixMode: PREFIX_MODE_CUSTOM,
          domainMode: 'root',
          localPart: '',
          subdomain: '',
        }}
        onFinish={onSubmit}
      >
        <Form.Item shouldUpdate noStyle>
          {({ getFieldValue }) => {
            const prefixMode = getFieldValue('prefixMode');
            const domainMode = getFieldValue('domainMode');
            const domain = getFieldValue('domain');
            const localPart = getFieldValue('localPart');
            const subdomain = getFieldValue('subdomain');
            const isRandomPrefix = prefixMode === PREFIX_MODE_RANDOM;
            const isCustomSubdomain = domainMode === DOMAIN_MODE_CUSTOM_SUBDOMAIN;

            const previewAddress = buildMailboxPreviewAddress({
              domain,
              prefixMode,
              localPart,
              domainMode,
              subdomain,
            });
            return (
              <Space
                direction="vertical"
                size={12}
                style={{ width: '100%' }}
                className="mailbox-create-flow mailbox-create-flow-compact mailbox-create-simple-stack"
              >
                <div className="mailbox-form-panel mailbox-form-panel-hero mailbox-form-panel-responsive mailbox-form-panel-condensed mailbox-create-simple-panel">
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Text type="secondary" className="mailbox-create-section-caption mailbox-create-inline-caption">
                      选择主域名后，按需填写前缀或子域名。
                    </Text>

                    <Form.Item label="主域名" name="domain" rules={[{ required: true, message: '请选择域名' }]} style={{ marginBottom: 0 }}>
                      <Select
                        placeholder="请选择已添加的域名"
                        options={domainOptions}
                        showSearch
                        optionFilterProp="label"
                      />
                    </Form.Item>

                    <div className="mailbox-create-simple-row">
                      <Form.Item label="前缀生成方式" name="prefixMode" style={{ marginBottom: 0 }}>
                        <Radio.Group className="mailbox-mode-group mailbox-mode-group-responsive mailbox-mode-group-inline">
                          {MAILBOX_PREFIX_MODES.map((item) => (
                            <Radio.Button key={item.value} value={item.value}>{item.label}</Radio.Button>
                          ))}
                        </Radio.Group>
                      </Form.Item>

                      {!isRandomPrefix ? (
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
                        <Form.Item label="邮箱前缀" style={{ marginBottom: 0 }}>
                          <div className="mailbox-create-static-field mailbox-create-static-field-compact mailbox-create-static-field-emphasis">
                            <Text type="secondary">生成方式</Text>
                            <Text strong>系统自动生成</Text>
                          </div>
                        </Form.Item>
                      )}
                    </div>

                    <div className="mailbox-create-simple-row">
                      <Form.Item label="域名方式" name="domainMode" style={{ marginBottom: 0 }}>
                        <Radio.Group className="mailbox-mode-group mailbox-mode-group-responsive mailbox-mode-group-triple mailbox-domain-mode-group">
                          {MAILBOX_DOMAIN_MODES.map((item) => (
                            <Radio.Button key={item.value} value={item.value}>{item.label}</Radio.Button>
                          ))}
                        </Radio.Group>
                      </Form.Item>

                      {isCustomSubdomain ? (
                        <Form.Item
                          label="子域名前缀"
                          name="subdomain"
                          rules={[
                            { required: true, message: '请输入子域名前缀' },
                            {
                              pattern: /^[a-zA-Z0-9-]+$/,
                              message: '仅支持字母、数字、中划线',
                            },
                          ]}
                          style={{ marginBottom: 0 }}
                        >
                          <Input placeholder="例如 inbox / mail / team" />
                        </Form.Item>
                      ) : domainMode === 'random-subdomain' ? (
                        <Form.Item label="子域名前缀" style={{ marginBottom: 0 }}>
                          <div className="mailbox-create-static-field mailbox-create-static-field-compact">
                            <Text type="secondary">生成方式</Text>
                            <Text strong>系统自动生成</Text>
                          </div>
                        </Form.Item>
                      ) : (
                        <Form.Item label="子域名前缀" style={{ marginBottom: 0 }}>
                          <div className="mailbox-create-static-field mailbox-create-static-field-compact">
                            <Text type="secondary">当前模式</Text>
                            <Text strong>直接使用主域名</Text>
                          </div>
                        </Form.Item>
                      )}
                    </div>

                    <div className="mailbox-create-summary-card mailbox-create-summary-card-compact mailbox-create-summary-card-inline">
                      <Space direction="vertical" size={10} style={{ width: '100%' }}>
                        <div className="mailbox-create-summary-head">
                          <Space wrap size={[6, 6]} className="mailbox-preview-head">
                            <Text strong>预览</Text>
                          </Space>
                        </div>

                        <Text className="mailbox-preview-address mailbox-preview-address-responsive">
                          {previewAddress}
                        </Text>

                        <Text type="secondary" className="mailbox-create-hint-text">
                          重复时更换前缀或子域名即可。
                        </Text>
                      </Space>
                    </div>
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