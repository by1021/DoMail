import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App as AntdApp,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
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
  InboxOutlined,
  MailOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  createApiToken,
  createDomain,
  createMailbox,
  deleteApiToken,
  deleteDomain,
  deleteMailbox,
  deleteMessage,
  detectDomainDns,
  extractErrorMessage,
  getApiTokens,
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
import MessagePreviewCard from './components/MessagePreviewCard.jsx';
import {
  buildHealthItems,
  buildSummaryCards,
  formatDateTime,
  formatRelativeTime,
  getRetentionLabel,
} from './app-helpers.js';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

const SECTION_DEFINITIONS = [
  {
    icon: AppstoreOutlined,
    text: '概览',
    value: 'overview',
  },
  {
    icon: GlobalOutlined,
    text: '域名',
    value: 'domains',
  },
  {
    icon: MailOutlined,
    text: '邮箱',
    value: 'mailboxes',
  },
  {
    icon: InboxOutlined,
    text: '邮件',
    value: 'messages',
  },
  {
    icon: ApiOutlined,
    text: 'API',
    value: 'api',
  },
];

function buildSectionOptions(activeSection) {
  return SECTION_DEFINITIONS.map(({ icon: Icon, text, value }) => ({
    label: (
      <div className={`nav-option${value === activeSection ? ' nav-option-active' : ''}`}>
        <Icon className="nav-option-icon" />
        <span className="nav-option-text">{text}</span>
      </div>
    ),
    value,
  }));
}

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
    description: '按邮箱查看邮件并快速处理未读内容',
  },
  api: {
    title: 'API',
    description: '创建 Bearer Token 并查询邮件列表与详情',
  },
};

const API_ENDPOINTS = [
  {
    key: 'messages',
    title: '全部邮件',
    endpoint: 'GET /api/mailboxes/:mailboxId/messages',
    summary: '按邮箱获取完整邮件列表。',
  },
  {
    key: 'latest',
    title: '最新邮件',
    endpoint: 'GET /api/mailboxes/:mailboxId/messages?latest=1',
    summary: '只读取最新一封邮件。',
  },
  {
    key: 'detail',
    title: '邮件详情',
    endpoint: 'GET /api/messages/:messageId',
    summary: '根据 messageId 获取正文详情。',
  },
];

function WorkspaceBrand() {
  return (
    <div className="brand-block">
      <div className="brand-surface">
        <Space direction="vertical" size={14} style={{ width: '100%' }} align="center">
          <Avatar size={56} icon={<ThunderboltOutlined />} className="app-brand-logo" />
          <div className="brand-copy">
            <Title level={4} className="app-brand-title" style={{ margin: 0 }}>
              域名邮箱
            </Title>
            <Text type="secondary">DoMail 管理工作台</Text>
          </div>
        </Space>
      </div>
    </div>
  );
}

function SectionHero({ title, description, extra = null, eyebrow = 'DoMail Workspace' }) {
  return (
    <Card className="section-intro-card page-toolbar-card">
      <Row justify="space-between" align="middle" gutter={[16, 16]}>
        <Col flex="auto">
          <Space direction="vertical" size={4}>
            <Text type="secondary" className="section-eyebrow">
              {eyebrow}
            </Text>
            <Title level={4} style={{ margin: 0 }}>
              {title}
            </Title>
            <Text type="secondary">{description}</Text>
          </Space>
        </Col>
        {extra ? <Col>{extra}</Col> : null}
      </Row>
    </Card>
  );
}

export default function App({ adminProfile = null, onLogout = null }) {
  const { message } = AntdApp.useApp();
  const [section, setSection] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState(null);
  const [domains, setDomains] = useState([]);
  const [mailboxes, setMailboxes] = useState([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageDetail, setMessageDetail] = useState(null);
  const [domainModalOpen, setDomainModalOpen] = useState(false);
  const [domainDrawerOpen, setDomainDrawerOpen] = useState(false);
  const [domainDetail, setDomainDetail] = useState(null);
  const [domainDnsStatus, setDomainDnsStatus] = useState({});
  const [mailboxModalOpen, setMailboxModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [apiTokens, setApiTokens] = useState([]);
  const [newApiToken, setNewApiToken] = useState(null);
  const [domainForm] = Form.useForm();
  const [mailboxForm] = Form.useForm();
  const [retentionForm] = Form.useForm();
  const [apiTokenForm] = Form.useForm();

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
  const sectionOptions = useMemo(() => buildSectionOptions(section), [section]);
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

  const loadMessages = useCallback(
    async (mailboxId, options = {}) => {
      const { keepSection = false, silent = false } = options;

      if (!mailboxId) {
        setMessages([]);
        setSelectedMailboxId(null);
        return;
      }

      try {
        if (!silent) {
          setLoading(true);
        }
        const response = await getMailboxMessages(mailboxId);
        setSelectedMailboxId(mailboxId);
        setMessages(response.items ?? []);
        if (!keepSection) {
          setSection('messages');
        }
      } catch (error) {
        if (!silent) {
          message.error(extractErrorMessage(error, '加载邮件列表失败'));
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [message],
  );

  async function loadApiTokens(options = {}) {
    try {
      const response = await getApiTokens();
      setApiTokens(response.items ?? []);

      if (!options.silentSuccess) {
        return response.items ?? [];
      }

      return response.items ?? [];
    } catch (error) {
      message.error(extractErrorMessage(error, '加载 API Token 失败'));
      return [];
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      const [healthResponse, domainsResponse, mailboxesResponse, apiTokensResponse] = await Promise.all([
        getHealth(),
        getDomains(),
        getMailboxes(),
        getApiTokens(),
      ]);

      const nextDomains = domainsResponse.items ?? [];
      const nextMailboxes = mailboxesResponse.items ?? [];
      const nextApiTokens = apiTokensResponse.items ?? [];

      setHealth(healthResponse);
      setDomains(nextDomains);
      setMailboxes(nextMailboxes);
      setApiTokens(nextApiTokens);

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
    if (!selectedMailboxId) {
      return undefined;
    }

    loadMessages(selectedMailboxId, {
      keepSection: true,
      silent: true,
    });

    const pollTimer = window.setInterval(() => {
      loadMessages(selectedMailboxId, {
        keepSection: true,
        silent: true,
      });
    }, 5000);

    return () => {
      window.clearInterval(pollTimer);
    };
  }, [loadMessages, selectedMailboxId, section]);

  useEffect(() => {
    retentionForm.setFieldsValue({
      retentionValue: selectedMailbox?.retentionValue ?? null,
      retentionUnit: selectedMailbox?.retentionUnit ?? 'hour',
    });
  }, [selectedMailbox, retentionForm]);

  async function handleCreateDomain(values) {
    try {
      setSubmitting(true);
      const createdResponse = await createDomain({
        domain: values.domain,
        smtpHost: values.smtpHost || null,
        smtpPort: values.smtpPort ? Number(values.smtpPort) : null,
        note: values.note || '',
        setupNote: values.setupNote || '',
      });
      const createdDomain = createdResponse?.item ?? null;

      await loadData();

      if (createdDomain?.id) {
        await handleDetectDomainDns(createdDomain.id, { silent: true });
      }

      message.success('域名已创建，已自动开始检测 MX 记录');
      setDomainModalOpen(false);
      domainForm.resetFields();
    } catch (error) {
      message.error(extractErrorMessage(error, '创建域名失败'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDetectDomainDns(domainId, options = {}) {
    try {
      const response = await detectDomainDns(domainId);
      const nextStatus = response.item ?? null;

      setDomainDnsStatus((current) => ({
        ...current,
        [domainId]: nextStatus,
      }));

      if (options.syncDetail && domainDetail?.id === domainId && nextStatus) {
        setDomainDetail((current) => (
          current
            ? {
                ...current,
                dnsCheck: nextStatus,
              }
            : current
        ));
      }

      if (!options.silent) {
        message.success(nextStatus?.summary || 'DNS 检测已完成');
      }

      return nextStatus;
    } catch (error) {
      if (!options.silent) {
        message.error(extractErrorMessage(error, '检测 DNS 状态失败'));
      }
      return null;
    }
  }

  async function handleOpenDomainDetail(domainId) {
    try {
      setLoading(true);
      const [detailResponse, dnsResponse] = await Promise.all([
        getDomainDetail(domainId),
        detectDomainDns(domainId),
      ]);
      const nextDnsCheck = dnsResponse.item ?? null;

      setDomainDnsStatus((current) => ({
        ...current,
        [domainId]: nextDnsCheck,
      }));
      setDomainDetail({
        ...detailResponse.item,
        dnsCheck: nextDnsCheck,
      });
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
        setMessageDetail(null);
      }

      if (selectedMailboxId) {
        await loadMessages(selectedMailboxId, { keepSection: true });
      } else {
        await loadData();
      }
    } catch (error) {
      message.error(extractErrorMessage(error, '删除邮件失败'));
    }
  }

  function handleBackToMessageList() {
    setMessageDetail(null);
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
    } catch (error) {
      message.error(extractErrorMessage(error, '更新自动清理设置失败'));
    }
  }

  async function handleCreateApiToken(values) {
    try {
      setSubmitting(true);
      const response = await createApiToken({
        name: values.name,
      });

      setNewApiToken(response.item ?? null);
      apiTokenForm.resetFields();
      await loadApiTokens({ silentSuccess: true });
      message.success('API Token 已创建，仅本次展示明文');
    } catch (error) {
      message.error(extractErrorMessage(error, '创建 API Token 失败'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteApiToken(tokenId) {
    try {
      await deleteApiToken(tokenId);
      if (newApiToken?.id === tokenId) {
        setNewApiToken(null);
      }
      await loadApiTokens({ silentSuccess: true });
      message.success('API Token 已删除');
    } catch (error) {
      message.error(extractErrorMessage(error, '删除 API Token 失败'));
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
          <Button type="link" onClick={() => loadMessages(record.id, { keepSection: false })}>
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

  const apiTokenColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (value, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{value}</Text>
          <Text type="secondary">前缀：{record.tokenPrefix}</Text>
        </Space>
      ),
    },
    {
      title: '最近使用',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      render: (value) => (
        <Space direction="vertical" size={2}>
          <Text>{formatDateTime(value)}</Text>
          <Text type="secondary">{value ? formatRelativeTime(value) : '尚未使用'}</Text>
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value) => (
        <Space direction="vertical" size={2}>
          <Text>{formatDateTime(value)}</Text>
          <Text type="secondary">{formatRelativeTime(value)}</Text>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Popconfirm title="确认删除该 API Token？" onConfirm={() => handleDeleteApiToken(record.id)}>
          <Button danger type="text" icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  function openMailboxModal(defaults = {}) {
    mailboxForm.setFieldsValue({
      random: false,
      ...defaults,
    });
    setMailboxModalOpen(true);
  }

  return (
    <Layout className="app-shell app-shell-responsive">
      <Sider width={320} theme="light" className="app-sider">
        <WorkspaceBrand />

        <div className="side-panel side-panel-navigation">
          <Segmented
            block
            vertical
            className="section-segmented"
            value={section}
            onChange={setSection}
            options={sectionOptions}
          />
        </div>

      </Sider>

      <Layout className="app-main-layout">
        <Header className="app-header">
          <Row className="app-header-main" align="middle" justify="space-between" gutter={[16, 16]} wrap>
            <Col flex="auto">
              <div className="header-title-wrap">
                <Space direction="vertical" size={4}>
                  <Text type="secondary" className="section-eyebrow">
                    DoMail Workspace
                  </Text>
                  <Title level={3} style={{ margin: 0 }}>
                    {currentSectionMeta.title}
                  </Title>
                  <Text type="secondary">{currentSectionMeta.description}</Text>
                </Space>
              </div>
            </Col>
            <Col>
              <div className="header-actions">
                <div className="header-search-wrap">
                  <Input
                    aria-label="全局搜索"
                    placeholder="搜索域名、邮箱、主题"
                    prefix={<SearchOutlined />}
                    className="global-search"
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                  />
                </div>
                <div className="header-action-buttons">
                  <Button icon={<ReloadOutlined />} onClick={loadData} className="header-refresh-button">
                    刷新
                  </Button>
                  {adminProfile?.username ? (
                    <div className="admin-session-card" aria-label={`当前管理员 ${adminProfile.username}`}>
                      <div className="admin-session-label">管理员</div>
                      <div className="admin-session-value">{adminProfile.username}</div>
                    </div>
                  ) : null}
                  {onLogout ? (
                    <Button onClick={onLogout} className="header-logout-button">
                      退出登录
                    </Button>
                  ) : null}
                </div>
              </div>
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
                domainDnsStatus={domainDnsStatus}
                formatDateTime={formatDateTime}
                onCreateDomain={() => setDomainModalOpen(true)}
                onDeleteDomain={handleDeleteDomain}
                onDetectDns={handleDetectDomainDns}
                onOpenDetail={handleOpenDomainDetail}
                onCreateMailbox={() => openMailboxModal({ random: false })}
              />
            )}

            {section === 'mailboxes' && (
              <Space direction="vertical" size={16} style={{ width: '100%' }} className="page-section">
                <SectionHero
                  title="邮箱管理"
                  description="为域名生成收件地址，支持手动前缀与随机前缀两种方式。"
                  extra={(
                    <Space wrap>
                      <Button onClick={() => openMailboxModal({ random: true })} disabled={!hasDomains}>
                        随机生成邮箱
                      </Button>
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => openMailboxModal({ random: false })} disabled={!hasDomains}>
                        创建邮箱
                      </Button>
                    </Space>
                  )}
                />

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
              <Space direction="vertical" size={16} style={{ width: '100%' }} className="page-section">
                <SectionHero
                  title={messageDetail ? '邮件详情' : '邮件收件区'}
                  description={
                    messageDetail
                      ? '聚焦查看当前邮件内容，处理完成后可返回邮件列表继续浏览。'
                      : '选择邮箱后集中查看最新邮件，常用操作都放在当前页完成。'
                  }
                  extra={(
                    <Space wrap>
                      <Select
                        aria-label="选择邮箱"
                        value={selectedMailboxId}
                        onChange={(value) => loadMessages(value, { keepSection: true })}
                        className="mailbox-selector"
                        placeholder="选择邮箱"
                        options={mailboxes.map((item) => ({
                          label: item.address,
                          value: item.id,
                        }))}
                      />
                    </Space>
                  )}
                />

                {messageDetail ? (
                  <div className="message-detail-layout">
                    <MessageDetailDrawer
                      messageDetail={messageDetail}
                      onDeleteMessage={handleDeleteMessage}
                      onBack={handleBackToMessageList}
                      formatDateTime={formatDateTime}
                    />
                  </div>
                ) : (
                  <Row gutter={[16, 16]} align="top">
                    <Col xs={24} xl={14}>
                      <Card
                        title="邮件收件区"
                        extra={<Tag color={unreadCount ? 'error' : 'success'}>{unreadCount} 未读</Tag>}
                      >
                        {filteredMessages.length === 0 ? (
                          <Empty description="当前还没有收件记录" />
                        ) : (
                          <Space direction="vertical" size={12} style={{ width: '100%' }}>
                            {filteredMessages.map((item) => (
                              <MessagePreviewCard
                                key={item.id}
                                item={item}
                                formatDateTime={formatDateTime}
                                onOpen={handleOpenMessageDetail}
                                onDelete={handleDeleteMessage}
                                confirmDelete
                              />
                            ))}
                          </Space>
                        )}
                      </Card>
                    </Col>

                    <Col xs={24} xl={10}>
                      <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        <Card title="当前邮箱概况">
                          {selectedMailbox ? (
                            <Space direction="vertical" size={16} style={{ width: '100%' }}>
                              <Descriptions column={1} className="mailbox-info" size="small">
                                <Descriptions.Item label="邮箱地址">{selectedMailbox.address}</Descriptions.Item>
                                <Descriptions.Item label="所属域名">{selectedMailbox.domain}</Descriptions.Item>
                                <Descriptions.Item label="创建方式">{selectedMailbox.source}</Descriptions.Item>
                                <Descriptions.Item label="最近收件">
                                  {formatDateTime(selectedMailbox.latestReceivedAt)}
                                </Descriptions.Item>
                                <Descriptions.Item label="自动清理">{getRetentionLabel(selectedMailbox)}</Descriptions.Item>
                              </Descriptions>

                              <div className="message-summary-panel">
                                <Text strong className="message-summary-line">
                                  当前 {messages.length} 封邮件，未读 {unreadCount} 封。
                                </Text>
                                <List
                                  split={false}
                                  dataSource={[
                                    '点击邮件卡片后，会切换到沉浸式详情页。',
                                    '不需要的邮件可直接删除。',
                                  ]}
                                  renderItem={(item) => <List.Item className="message-tip-item">{item}</List.Item>}
                                />
                              </div>
                            </Space>
                          ) : (
                            <Empty description="请先创建邮箱" />
                          )}
                        </Card>

                        <Card title="当前邮箱设置">
                          {selectedMailbox ? (
                            <div>
                              <Text strong style={{ display: 'block', marginBottom: 12 }}>
                                自动清理设置
                              </Text>
                              <Form
                                form={retentionForm}
                                layout="vertical"
                                onFinish={handleUpdateRetention}
                                initialValues={{ retentionValue: null, retentionUnit: 'hour' }}
                                className="retention-form"
                              >
                                <Space wrap align="start">
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
                                </Space>
                              </Form>
                            </div>
                          ) : (
                            <Empty description="请先创建邮箱" />
                          )}
                        </Card>

                        <MessageDetailDrawer
                          messageDetail={messageDetail}
                          onDeleteMessage={handleDeleteMessage}
                          onBack={handleBackToMessageList}
                          formatDateTime={formatDateTime}
                        />
                      </Space>
                    </Col>
                  </Row>
                )}
              </Space>
            )}

            {section === 'api' && (
              <Space direction="vertical" size={16} style={{ width: '100%' }} className="page-section">
                <Card className="api-hero-card">
                  <div className="api-hero-layout">
                    <div className="api-hero-main">
                      <Space direction="vertical" size={10} style={{ width: '100%' }}>
                        <Tag color="blue" className="api-hero-tag">
                          Bearer Token
                        </Tag>
                        <Title level={4} style={{ margin: 0 }}>
                          API 调用中心
                        </Title>
                        <Text type="secondary" className="api-hero-copy">
                          在这里统一完成 Token 创建、只读接口查阅与联调准备。页面重点聚焦 Bearer Token
                          的生成、复制和接口调用说明，减少切换成本。
                        </Text>
                      </Space>
                    </div>
                    <div className="api-hero-meta">
                      <div className="api-hero-stat">
                        <Text type="secondary">可用 Token</Text>
                        <Text strong className="api-hero-stat-value">
                          {apiTokens.length}
                        </Text>
                      </div>
                      <div className="api-hero-stat">
                        <Text type="secondary">接口条目</Text>
                        <Text strong className="api-hero-stat-value">
                          {API_ENDPOINTS.length}
                        </Text>
                      </div>
                    </div>
                  </div>
                </Card>

                {newApiToken?.token ? (
                  <Card className="api-token-highlight-card" title="新建 Token">
                    <Space direction="vertical" size={10} style={{ width: '100%' }}>
                      <div className="api-token-highlight-head">
                        <Text>
                          名称：<Text strong>{newApiToken.name}</Text>
                        </Text>
                        <Tag color="success">仅展示一次</Tag>
                      </div>
                      <Text copyable={{ text: newApiToken.token }} code className="api-token-inline-code">
                        {newApiToken.token}
                      </Text>
                      <Text type="secondary">请立即复制保存，该 Token 不会再次完整展示。</Text>
                    </Space>
                  </Card>
                ) : null}

                <div className="api-compact-grid api-layout-grid">
                  <Card title="添加 Token" className="api-card api-create-card">
                    <Space direction="vertical" size={18} style={{ width: '100%' }}>
                      <div className="api-panel-intro">
                        <Text strong>创建新的 Bearer Token</Text>
                        <Text type="secondary">
                          建议按调用场景命名，便于后续区分机器人、脚本或不同系统来源。
                        </Text>
                      </div>

                      <Form form={apiTokenForm} layout="vertical" onFinish={handleCreateApiToken}>
                        <Form.Item
                          label="Token 名称"
                          name="name"
                          rules={[
                            { required: true, message: '请输入 Token 名称' },
                          ]}
                        >
                          <Input
                            aria-label="Token 名称"
                            placeholder="例如：收件机器人"
                            maxLength={120}
                          />
                        </Form.Item>
                        <Button type="primary" htmlType="submit" loading={submitting} block>
                          创建 Token
                        </Button>
                      </Form>

                      <div className="api-create-tips">
                        <Text strong className="api-tips-title">
                          使用建议
                        </Text>
                        <List
                          split={false}
                          dataSource={[
                            '创建成功后立即复制保存明文 Token。',
                            'Token 仅适用于只读邮件查询接口。',
                            '不再使用时可在下方列表中直接删除。',
                          ]}
                          renderItem={(item) => <List.Item className="guide-item">{item}</List.Item>}
                        />
                      </div>
                    </Space>
                  </Card>

                  <Card title="核心接口" className="api-card api-endpoints-card">
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                      <div className="api-auth-panel">
                        <div className="api-auth-panel-head">
                          <Text strong>鉴权请求头</Text>
                          <Tag color="processing">Bearer</Tag>
                        </div>
                        <pre className="message-code-block api-code-block">
Authorization: Bearer {'<token>'}
                        </pre>
                      </div>

                      <div className="api-endpoint-list">
                        {API_ENDPOINTS.map((item) => (
                          <div key={item.key} className="api-endpoint-item">
                            <div className="api-endpoint-head">
                              <Text strong>{item.title}</Text>
                              <Tag color="blue">READ ONLY</Tag>
                            </div>
                            <pre className="message-code-block api-code-block">{item.endpoint}</pre>
                            <Text type="secondary">{item.summary}</Text>
                          </div>
                        ))}
                      </div>
                    </Space>
                  </Card>
                </div>

                <Card title="已有 Token" className="api-card api-token-table-card">
                  <Table
                    rowKey="id"
                    columns={apiTokenColumns}
                    dataSource={apiTokens}
                    pagination={false}
                    locale={{ emptyText: '还没有 API Token，请先创建一个。' }}
                  />
                </Card>
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
        onDetectDns={handleDetectDomainDns}
        onCreateMailbox={() => {
          setDomainDrawerOpen(false);
          openMailboxModal({
            random: false,
            domainId: domainDetail?.id,
          });
        }}
        formatDateTime={formatDateTime}
      />

    </Layout>
  );
}