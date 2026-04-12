import React, { useEffect, useMemo, useState } from 'react';
import {
  App as AntdApp,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Form,
  Input,
  Layout,
  List,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  ApiOutlined,
  AppstoreOutlined,
  DeleteOutlined,
  GlobalOutlined,
  EyeOutlined,
  InboxOutlined,
  MailOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  createDomain,
  createMailbox,
  deleteDomain,
  deleteMailbox,
  deleteMessage,
  extractErrorMessage,
  getDomainDetail,
  getDomains,
  getHealth,
  getMailboxMessages,
  getMailboxes,
  getMessageDetail,
  markMessageRead,
  updateMailboxRetention,
} from './api.js';
import DomainTableSection from './components/DomainTableSection.jsx';
import DomainCreateModal from './components/DomainCreateModal.jsx';
import DomainDetailDrawer from './components/DomainDetailDrawer.jsx';
import MailboxCreateModal from './components/MailboxCreateModal.jsx';
import OverviewSection from './components/OverviewSection.jsx';
import MessageDetailDrawer from './components/MessageDetailDrawer.jsx';
import {
  buildHealthItems,
  buildSummaryCards,
  formatDateTime,
  formatRelativeTime,
  getRetentionLabel,
} from './app-helpers.js';

const { Header, Content, Sider } = Layout;
const { Title, Paragraph, Text } = Typography;

const SECTION_OPTIONS = [
  {
    label: (
      <div className="nav-option">
        <AppstoreOutlined className="nav-option-icon" />
        <span className="nav-option-text">概览</span>
      </div>
    ),
    value: 'overview',
  },
  {
    label: (
      <div className="nav-option">
        <GlobalOutlined className="nav-option-icon" />
        <span className="nav-option-text">域名</span>
      </div>
    ),
    value: 'domains',
  },
  {
    label: (
      <div className="nav-option">
        <MailOutlined className="nav-option-icon" />
        <span className="nav-option-text">邮箱</span>
      </div>
    ),
    value: 'mailboxes',
  },
  {
    label: (
      <div className="nav-option">
        <InboxOutlined className="nav-option-icon" />
        <span className="nav-option-text">邮件</span>
      </div>
    ),
    value: 'messages',
  },
  {
    label: (
      <div className="nav-option">
        <ApiOutlined className="nav-option-icon" />
        <span className="nav-option-text">API</span>
      </div>
    ),
    value: 'api',
  },
];

const SECTION_META = {
  overview: {
    title: '概览',
    description: '查看整体收件状态与推荐操作',
  },
  domains: {
    title: '域名',
    description: '管理域名接入与 DNS 配置进度',
  },
  mailboxes: {
    title: '邮箱',
    description: '创建收件地址并查看邮箱容量',
  },
  messages: {
    title: '邮件',
    description: '集中处理邮件列表与详情',
  },
  api: {
    title: 'API',
    description: '查看接口规划与联调参考',
  },
};

function MessagePreview({ item, onOpen, onDelete }) {
  return (
    <Card className="message-preview-card" hoverable onClick={() => onOpen(item.id)}>
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <div className="message-preview-header">
          <Space wrap>
            <Text strong>{item.subject || '(no subject)'}</Text>
            {!item.isRead && <Tag color="blue">未读</Tag>}
            {item.attachmentCount > 0 && <Tag color="purple">{item.attachmentCount} 个附件</Tag>}
          </Space>
          <Text type="secondary">{formatDateTime(item.receivedAt)}</Text>
        </div>

        <div className="message-preview-meta">
          <Text type="secondary">发件人：{item.fromAddress || item.envelopeFrom || '-'}</Text>
          <Text type="secondary">收件人：{item.envelopeTo || '-'}</Text>
        </div>

        <Space wrap>
          <Button
            type="link"
            icon={<EyeOutlined />}
            style={{ paddingInline: 0 }}
            onClick={(event) => {
              event.stopPropagation();
              onOpen(item.id);
            }}
          >
            查看详情
          </Button>
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
        </Space>
      </Space>
    </Card>
  );
}

export default function App() {
  const { message } = AntdApp.useApp();
  const [section, setSection] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState(null);
  const [domains, setDomains] = useState([]);
  const [mailboxes, setMailboxes] = useState([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageDetail, setMessageDetail] = useState(null);
  const [messageDrawerOpen, setMessageDrawerOpen] = useState(false);
  const [domainModalOpen, setDomainModalOpen] = useState(false);
  const [domainDrawerOpen, setDomainDrawerOpen] = useState(false);
  const [domainDetail, setDomainDetail] = useState(null);
  const [mailboxModalOpen, setMailboxModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [domainForm] = Form.useForm();
  const [mailboxForm] = Form.useForm();
  const [retentionForm] = Form.useForm();

  const summaryCards = useMemo(
    () => buildSummaryCards(health?.stats, domains, mailboxes, messages),
    [health, domains, mailboxes, messages],
  );

  const healthItems = useMemo(
    () => buildHealthItems(health, domains, mailboxes, messages),
    [health, domains, mailboxes, messages],
  );

  const unreadCount = useMemo(
    () => messages.filter((item) => !item.isRead).length,
    [messages],
  );

  const latestDomain = domains[0] || null;
  const latestMailbox = mailboxes[0] || null;
  const latestMessage = messages[0] || null;
  const hasDomains = domains.length > 0;
  const hasMailboxes = mailboxes.length > 0;
  const currentSectionMeta = SECTION_META[section] ?? SECTION_META.overview;

  const normalizedSearchText = useMemo(() => searchText.trim().toLowerCase(), [searchText]);

  const filteredDomains = useMemo(() => {
    if (!normalizedSearchText) {
      return domains;
    }

    return domains.filter(
      (item) =>
        item.domain.toLowerCase().includes(normalizedSearchText) ||
        (item.note || '').toLowerCase().includes(normalizedSearchText),
    );
  }, [domains, normalizedSearchText]);

  const filteredMailboxes = useMemo(() => {
    if (!normalizedSearchText) {
      return mailboxes;
    }

    return mailboxes.filter(
      (item) =>
        item.address.toLowerCase().includes(normalizedSearchText) ||
        item.domain.toLowerCase().includes(normalizedSearchText),
    );
  }, [mailboxes, normalizedSearchText]);

  const filteredMessages = useMemo(() => {
    if (!normalizedSearchText) {
      return messages;
    }

    return messages.filter(
      (item) =>
        (item.subject || '').toLowerCase().includes(normalizedSearchText) ||
        (item.fromAddress || '').toLowerCase().includes(normalizedSearchText) ||
        (item.envelopeTo || '').toLowerCase().includes(normalizedSearchText),
    );
  }, [messages, normalizedSearchText]);

  const selectedMailbox = mailboxes.find((item) => item.id === selectedMailboxId) || null;

  async function loadMessages(mailboxId, keepSection = false) {
    if (!mailboxId) {
      setMessages([]);
      setSelectedMailboxId(null);
      return;
    }

    try {
      setLoading(true);
      const response = await getMailboxMessages(mailboxId);
      setSelectedMailboxId(mailboxId);
      setMessages(response.items ?? []);
      if (!keepSection) {
        setSection('messages');
      }
    } catch (error) {
      message.error(extractErrorMessage(error, '加载邮件列表失败'));
    } finally {
      setLoading(false);
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      const [healthResponse, domainsResponse, mailboxesResponse] = await Promise.all([
        getHealth(),
        getDomains(),
        getMailboxes(),
      ]);

      const nextDomains = domainsResponse.items ?? [];
      const nextMailboxes = mailboxesResponse.items ?? [];

      setHealth(healthResponse);
      setDomains(nextDomains);
      setMailboxes(nextMailboxes);

      const nextMailboxId =
        selectedMailboxId && nextMailboxes.some((item) => item.id === selectedMailboxId)
          ? selectedMailboxId
          : nextMailboxes[0]?.id;

      if (nextMailboxId) {
        const messageResponse = await getMailboxMessages(nextMailboxId);
        setSelectedMailboxId(nextMailboxId);
        setMessages(messageResponse.items ?? []);
      } else {
        setSelectedMailboxId(null);
        setMessages([]);
      }

      const selectedMailboxRecord = nextMailboxes.find((item) => item.id === nextMailboxId);

      retentionForm.setFieldsValue({
        retentionValue: selectedMailboxRecord?.retentionValue ?? null,
        retentionUnit: selectedMailboxRecord?.retentionUnit ?? 'hour',
      });
    } catch (error) {
      message.error(extractErrorMessage(error, '加载数据失败，请确认后端 API 可用'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    retentionForm.setFieldsValue({
      retentionValue: selectedMailbox?.retentionValue ?? null,
      retentionUnit: selectedMailbox?.retentionUnit ?? 'hour',
    });
  }, [selectedMailbox, retentionForm]);

  async function handleCreateDomain(values) {
    try {
      setSubmitting(true);
      await createDomain({
        domain: values.domain,
        smtpHost: values.smtpHost || null,
        smtpPort: values.smtpPort ? Number(values.smtpPort) : null,
        note: values.note || '',
        setupNote: values.setupNote || '',
      });
      message.success('域名已创建');
      setDomainModalOpen(false);
      domainForm.resetFields();
      await loadData();
    } catch (error) {
      message.error(extractErrorMessage(error, '创建域名失败'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOpenDomainDetail(domainId) {
    try {
      setLoading(true);
      const response = await getDomainDetail(domainId);
      setDomainDetail(response.item);
      setDomainDrawerOpen(true);
    } catch (error) {
      message.error(extractErrorMessage(error, '加载域名详情失败'));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateMailbox(values) {
    try {
      setSubmitting(true);
      await createMailbox({
        domainId: values.domainId,
        localPart: values.random ? undefined : values.localPart,
        random: values.random,
      });
      message.success('邮箱已创建');
      setMailboxModalOpen(false);
      mailboxForm.resetFields();
      await loadData();
    } catch (error) {
      message.error(extractErrorMessage(error, '创建邮箱失败'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteDomain(id) {
    try {
      await deleteDomain(id);
      message.success('域名已删除');
      await loadData();
    } catch (error) {
      message.error(extractErrorMessage(error, '删除域名失败'));
    }
  }

  async function handleDeleteMailbox(id) {
    try {
      await deleteMailbox(id);
      message.success('邮箱已删除');
      await loadData();
    } catch (error) {
      message.error(extractErrorMessage(error, '删除邮箱失败'));
    }
  }

  async function handleOpenMessageDetail(messageId) {
    try {
      setLoading(true);
      const detailResponse = await getMessageDetail(messageId);
      setMessageDetail(detailResponse.item);
      setMessageDrawerOpen(true);

      if (!detailResponse.item?.isRead) {
        const readResponse = await markMessageRead(messageId);
        setMessageDetail(readResponse.item);
        setMessages((current) =>
          current.map((item) =>
            item.id === messageId
              ? {
                  ...item,
                  isRead: true,
                }
              : item,
          ),
        );
      }
    } catch (error) {
      message.error(extractErrorMessage(error, '加载邮件详情失败'));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteMessage(id) {
    try {
      await deleteMessage(id);
      message.success('邮件已删除');

      if (messageDetail?.id === id) {
        setMessageDrawerOpen(false);
        setMessageDetail(null);
      }

      if (selectedMailboxId) {
        await loadMessages(selectedMailboxId, true);
      } else {
        await loadData();
      }
    } catch (error) {
      message.error(extractErrorMessage(error, '删除邮件失败'));
    }
  }

  async function handleUpdateRetention(values) {
    if (!selectedMailboxId) {
      message.warning('请先选择邮箱');
      return;
    }

    try {
      const payload = {
        retentionValue: values.retentionValue ? Number(values.retentionValue) : null,
        retentionUnit: values.retentionValue ? values.retentionUnit : null,
      };

      await updateMailboxRetention(selectedMailboxId, payload);
      message.success(payload.retentionValue ? '自动清理设置已更新' : '已关闭自动清理');
      await loadData();
      if (selectedMailboxId) {
        await loadMessages(selectedMailboxId, true);
      }
    } catch (error) {
      message.error(extractErrorMessage(error, '更新自动清理设置失败'));
    }
  }

  const mailboxColumns = [
    {
      title: '邮箱地址',
      dataIndex: 'address',
      key: 'address',
      render: (value, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{value}</Text>
          <Text type="secondary">域名：{record.domain}</Text>
        </Space>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      render: (value) => <Tag color={value === 'random' ? 'blue' : 'purple'}>{value}</Tag>,
    },
    {
      title: '最近收件',
      dataIndex: 'latestReceivedAt',
      key: 'latestReceivedAt',
      render: (value) => (
        <Space direction="vertical" size={2}>
          <Text>{formatDateTime(value)}</Text>
          <Text type="secondary">{formatRelativeTime(value)}</Text>
        </Space>
      ),
    },
    {
      title: '邮件数',
      dataIndex: 'messageCount',
      key: 'messageCount',
      width: 90,
      render: (value) => <Badge count={value} showZero color="#1677ff" />,
    },
    {
      title: '操作',
      key: 'actions',
      width: 170,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => loadMessages(record.id)}>
            查看邮件
          </Button>
          <Popconfirm title="确认删除该邮箱？" onConfirm={() => handleDeleteMailbox(record.id)}>
            <Button danger type="text" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const domainOptions = domains.map((item) => ({
    label: item.domain,
    value: item.id,
  }));

  function openMailboxModal(defaults = {}) {
    mailboxForm.setFieldsValue({
      random: false,
      ...defaults,
    });
    setMailboxModalOpen(true);
  }

  return (
    <Layout className="app-shell">
      <Sider width={320} theme="light" className="app-sider">
        <div className="brand-block">
          <div className="brand-surface">
            <Space direction="vertical" size={12} style={{ width: '100%' }} align="center">
              <Avatar
                size={48}
                icon={<ThunderboltOutlined />}
                style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' }}
              />
              <div className="brand-copy">
                <Title level={4} style={{ margin: 0 }}>
                  域名邮箱
                </Title>
                <Text type="secondary">统一管理收件工作台</Text>
              </div>
            </Space>
          </div>
        </div>

        <div className="side-panel side-panel-navigation">
          <Segmented
            block
            vertical
            className="section-segmented"
            value={section}
            onChange={setSection}
            options={SECTION_OPTIONS}
          />
        </div>

      </Sider>

      <Layout>
        <Header className="app-header">
          <Row align="middle" justify="space-between" gutter={[16, 16]} wrap>
            <Col flex="auto">
              <div className="header-title-wrap">
                <Space direction="vertical" size={4}>
                  <Title level={3} style={{ margin: 0 }}>
                    {currentSectionMeta.title}
                  </Title>
                  <Text type="secondary">{currentSectionMeta.description}</Text>
                </Space>
              </div>
            </Col>
            <Col>
              <Space wrap size={12}>
                <Input
                  aria-label="全局搜索"
                  placeholder="搜索域名、邮箱、主题"
                  prefix={<SearchOutlined />}
                  className="global-search"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                />
                <Button icon={<ReloadOutlined />} onClick={loadData}>
                  刷新
                </Button>
              </Space>
            </Col>
          </Row>
        </Header>

        <Content className="app-content">
          <Spin spinning={loading}>
            {section === 'overview' && (
              <OverviewSection
                filteredMessages={filteredMessages}
                hasDomains={hasDomains}
                hasMailboxes={hasMailboxes}
                health={health}
                healthItems={healthItems}
                latestDomain={latestDomain}
                latestMailbox={latestMailbox}
                latestMessage={latestMessage}
                onCreateDomain={() => setDomainModalOpen(true)}
                onCreateMailbox={(random) => openMailboxModal({ random })}
                onDeleteMessage={handleDeleteMessage}
                onOpenMessageDetail={handleOpenMessageDetail}
                onViewMessages={() => setSection('messages')}
                summaryCards={summaryCards}
                formatDateTime={formatDateTime}
              />
            )}

            {section === 'domains' && (
              <DomainTableSection
                domains={filteredDomains}
                formatDateTime={formatDateTime}
                onCreateDomain={() => setDomainModalOpen(true)}
                onDeleteDomain={handleDeleteDomain}
                onOpenDetail={handleOpenDomainDetail}
              />
            )}

            {section === 'mailboxes' && (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Card className="section-intro-card">
                  <Row justify="space-between" align="middle" gutter={[16, 16]}>
                    <Col flex="auto">
                      <Space direction="vertical" size={4}>
                        <Title level={4} style={{ margin: 0 }}>
                          邮箱管理
                        </Title>
                        <Text type="secondary">
                          为域名生成收件地址，支持手动前缀与随机前缀两种方式。
                        </Text>
                      </Space>
                    </Col>
                    <Col>
                      <Space wrap>
                        <Button onClick={() => openMailboxModal({ random: true })} disabled={!hasDomains}>
                          随机生成邮箱
                        </Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => openMailboxModal({ random: false })} disabled={!hasDomains}>
                          创建邮箱
                        </Button>
                      </Space>
                    </Col>
                  </Row>
                </Card>

                <Card>
                  <Table
                    rowKey="id"
                    columns={mailboxColumns}
                    dataSource={filteredMailboxes}
                    locale={{ emptyText: '暂无邮箱，请先创建域名后新增邮箱。' }}
                    pagination={false}
                  />
                </Card>
              </Space>
            )}

            {section === 'messages' && (
              <Row gutter={[16, 16]}>
                <Col xs={24} xl={9}>
                  <Card
                    title="邮件列表"
                    extra={
                      <Select
                        value={selectedMailboxId}
                        onChange={(value) => loadMessages(value, true)}
                        className="mailbox-selector"
                        placeholder="选择邮箱"
                        options={mailboxes.map((item) => ({
                          label: item.address,
                          value: item.id,
                        }))}
                      />
                    }
                  >
                    {filteredMessages.length === 0 ? (
                      <Empty description="当前还没有收件记录" />
                    ) : (
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        {filteredMessages.map((item) => (
                          <MessagePreview
                            key={item.id}
                            item={item}
                            onOpen={handleOpenMessageDetail}
                            onDelete={handleDeleteMessage}
                          />
                        ))}
                      </Space>
                    )}
                  </Card>
                </Col>

                <Col xs={24} xl={15}>
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <Card title="当前邮箱">
                      {selectedMailbox ? (
                        <Space direction="vertical" size={20} style={{ width: '100%' }}>
                          <Descriptions column={1} className="mailbox-info">
                            <Descriptions.Item label="邮箱地址">{selectedMailbox.address}</Descriptions.Item>
                            <Descriptions.Item label="所属域名">{selectedMailbox.domain}</Descriptions.Item>
                            <Descriptions.Item label="创建方式">{selectedMailbox.source}</Descriptions.Item>
                            <Descriptions.Item label="邮件数量">{selectedMailbox.messageCount}</Descriptions.Item>
                            <Descriptions.Item label="最近收件">
                              {formatDateTime(selectedMailbox.latestReceivedAt)}
                            </Descriptions.Item>
                            <Descriptions.Item label="自动清理">{getRetentionLabel(selectedMailbox)}</Descriptions.Item>
                          </Descriptions>

                          <Divider style={{ margin: 0 }} />

                          <div>
                            <Text strong style={{ display: 'block', marginBottom: 12 }}>
                              自动清理设置
                            </Text>
                            <Form
                              form={retentionForm}
                              layout="inline"
                              onFinish={handleUpdateRetention}
                              initialValues={{ retentionValue: null, retentionUnit: 'hour' }}
                            >
                              <Form.Item name="retentionValue">
                                <Input
                                  aria-label="自动清理时长"
                                  type="number"
                                  min={1}
                                  placeholder="关闭时留空"
                                  style={{ width: 140 }}
                                />
                              </Form.Item>
                              <Form.Item name="retentionUnit">
                                <Select
                                  aria-label="自动清理单位"
                                  style={{ width: 100 }}
                                  options={[
                                    { label: '小时', value: 'hour' },
                                    { label: '天', value: 'day' },
                                  ]}
                                />
                              </Form.Item>
                              <Form.Item>
                                <Button type="primary" htmlType="submit">
                                  保存
                                </Button>
                              </Form.Item>
                              <Form.Item>
                                <Button
                                  onClick={() => {
                                    retentionForm.setFieldsValue({ retentionValue: null, retentionUnit: 'hour' });
                                    retentionForm.submit();
                                  }}
                                >
                                  关闭自动清理
                                </Button>
                              </Form.Item>
                            </Form>
                          </div>
                        </Space>
                      ) : (
                        <Empty description="请先创建邮箱" />
                      )}
                    </Card>

                    <Card title="处理提示" extra={<Tag color={unreadCount ? 'error' : 'success'}>{unreadCount} 未读</Tag>}>
                      <List
                        split={false}
                        dataSource={[
                          `当前邮箱共有 ${messages.length} 封邮件，未读 ${unreadCount} 封。`,
                          '点击任意邮件卡片可打开详情抽屉并自动标记为已读。',
                          '邮件支持手动删除，自动清理可按小时或天设置。',
                        ]}
                        renderItem={(item) => <List.Item className="message-tip-item">{item}</List.Item>}
                      />
                    </Card>
                  </Space>
                </Col>
              </Row>
            )}

            {section === 'api' && (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Card className="section-intro-card">
                  <Space direction="vertical" size={4}>
                    <Title level={4} style={{ margin: 0 }}>
                      API 规划与调用入口
                    </Title>
                    <Text type="secondary">
                      当前前端已接入基础管理接口，以下内容可作为联调与验收参考。
                    </Text>
                  </Space>
                </Card>

                <Row gutter={[16, 16]}>
                  <Col xs={24} xl={8}>
                    <Card title="创建邮箱" className="api-card">
                      <Text code>POST /api/mailboxes</Text>
                      <Paragraph style={{ marginTop: 12, marginBottom: 12 }}>
                        支持传入域名、指定前缀或随机生成前缀。
                      </Paragraph>
                      <Tag color="purple">manual / random</Tag>
                    </Card>
                  </Col>

                  <Col xs={24} xl={8}>
                    <Card title="查询邮件列表" className="api-card">
                      <Text code>GET /api/mailboxes/:mailboxId/messages</Text>
                      <Paragraph style={{ marginTop: 12, marginBottom: 12 }}>
                        返回指定邮箱的邮件列表及收件摘要信息。
                      </Paragraph>
                      <Tag color="blue">mailbox messages</Tag>
                    </Card>
                  </Col>

                  <Col xs={24} xl={8}>
                    <Card title="邮件详情" className="api-card">
                      <Text code>GET /api/messages/:messageId</Text>
                      <Paragraph style={{ marginTop: 12, marginBottom: 12 }}>
                        返回正文、HTML、附件元数据和 SMTP 收件信息。
                      </Paragraph>
                      <Tag color="gold">detail + attachments</Tag>
                    </Card>
                  </Col>
                </Row>
              </Space>
            )}
          </Spin>
        </Content>
      </Layout>

      <DomainCreateModal
        form={domainForm}
        open={domainModalOpen}
        submitting={submitting}
        onCancel={() => setDomainModalOpen(false)}
        onSubmit={handleCreateDomain}
      />

      <MailboxCreateModal
        form={mailboxForm}
        open={mailboxModalOpen}
        submitting={submitting}
        domainOptions={domainOptions}
        onCancel={() => setMailboxModalOpen(false)}
        onSubmit={handleCreateMailbox}
      />

      <DomainDetailDrawer
        open={domainDrawerOpen}
        domainDetail={domainDetail}
        onClose={() => setDomainDrawerOpen(false)}
        formatDateTime={formatDateTime}
      />

      <MessageDetailDrawer
        open={messageDrawerOpen}
        messageDetail={messageDetail}
        onClose={() => setMessageDrawerOpen(false)}
        onDeleteMessage={handleDeleteMessage}
        formatDateTime={formatDateTime}
      />
    </Layout>
  );
}