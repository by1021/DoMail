import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  App as AntdApp,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  Layout,
  List,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  ApiOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  GlobalOutlined,
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

const { Header, Content, Sider } = Layout;
const { Title, Paragraph, Text } = Typography;

const SECTION_OPTIONS = [
  { label: '概览', value: 'overview' },
  { label: '域名', value: 'domains' },
  { label: '邮箱', value: 'mailboxes' },
  { label: '邮件', value: 'messages' },
  { label: 'API', value: 'api' },
];

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

function formatRelativeTime(value) {
  if (!value) {
    return '暂无记录';
  }

  const diffMinutes = dayjs().diff(dayjs(value), 'minute');

  if (diffMinutes < 1) {
    return '刚刚更新';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }

  const diffHours = dayjs().diff(dayjs(value), 'hour');

  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }

  return `${dayjs().diff(dayjs(value), 'day')} 天前`;
}

function buildSummaryCards(stats, domains, mailboxes, messages) {
  return [
    {
      title: '已配置域名',
      value: domains.length,
      icon: <GlobalOutlined />,
      accent: 'summary-card-blue',
      helper: '当前域名数量',
    },
    {
      title: '活跃邮箱',
      value: mailboxes.length,
      icon: <MailOutlined />,
      accent: 'summary-card-purple',
      helper: '当前邮箱数量',
    },
    {
      title: '当前列表邮件',
      value: messages.length,
      icon: <InboxOutlined />,
      accent: 'summary-card-cyan',
      helper: '当前列表邮件',
    },
    {
      title: '数据库邮件总量',
      value: stats?.messages ?? 0,
      icon: <ApiOutlined />,
      accent: 'summary-card-gold',
      helper: '累计邮件总数',
    },
  ];
}

function buildHealthItems(health, domains, mailboxes, messages) {
  const mailboxCoverage = domains.length ? Math.round((mailboxes.length / domains.length) * 100) : 0;
  const unreadCount = messages.filter((item) => !item.isRead).length;

  return [
    {
      label: '服务状态',
      value: health?.ok ? '在线' : '待连接',
      tone: health?.ok ? 'success' : 'processing',
      description: health?.service || 'domain-mail-backend',
    },
    {
      label: '域名覆盖',
      value: `${domains.length} / ${Math.max(domains.length, 1)}`,
      tone: domains.length ? 'processing' : 'default',
      description: domains.length ? '已具备收件配置' : '请先创建域名',
      progress: domains.length ? 100 : 12,
    },
    {
      label: '邮箱密度',
      value: `${mailboxes.length} 个`,
      tone: mailboxes.length ? 'processing' : 'warning',
      description: `${mailboxCoverage}% 域名覆盖率`,
      progress: Math.max(Math.min(mailboxCoverage, 100), 8),
    },
    {
      label: '待处理邮件',
      value: `${unreadCount} 封`,
      tone: unreadCount ? 'error' : 'success',
      description: unreadCount ? '存在未读邮件需要查看' : '所有邮件均已处理',
      progress: unreadCount ? Math.min(unreadCount * 15, 100) : 100,
    },
  ];
}

function getRetentionLabel(mailbox) {
  if (!mailbox?.retentionValue || !mailbox?.retentionUnit) {
    return '已关闭';
  }

  return `${mailbox.retentionValue} ${mailbox.retentionUnit === 'day' ? '天' : '小时'}`;
}

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

  return (
    <Layout className="app-shell">
      <Sider width={248} theme="light" className="app-sider">
        <div className="brand-block">
          <div className="brand-surface">
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Space align="center" size={10}>
                <Avatar
                  size={36}
                  icon={<ThunderboltOutlined />}
                  style={{ background: '#1677ff' }}
                />
                <Title level={4} style={{ margin: 0 }}>
                  域名邮箱
                </Title>
              </Space>
              <Text type="secondary">域名、邮箱与邮件的统一视图</Text>
              <Tag color={health?.ok ? 'success' : 'default'} style={{ width: 'fit-content', marginTop: 2 }}>
                {health?.ok ? '服务在线' : '等待连接'}
              </Tag>
            </Space>
          </div>
        </div>

        <div className="side-panel">
          <Text className="panel-label">导航</Text>
          <Segmented
            block
            vertical
            value={section}
            onChange={setSection}
            options={SECTION_OPTIONS}
          />
        </div>

        <div className="side-panel">
          <Text className="panel-label">概况</Text>
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <div className="status-chip">
              <ClockCircleOutlined />
              <span>{formatRelativeTime(health?.timestamp)}</span>
            </div>
            <div className="status-chip">
              <InboxOutlined />
              <span>未读 {unreadCount}</span>
            </div>
            <div className="status-chip">
              <MailOutlined />
              <span>{selectedMailbox?.address || '未选择邮箱'}</span>
            </div>
          </Space>
        </div>
      </Sider>

      <Layout>
        <Header className="app-header">
          <Row align="middle" justify="space-between" gutter={[16, 16]} wrap>
            <Col flex="auto">
              <div className="header-title-wrap">
                <Space direction="vertical" size={4}>
                  <Title level={3} style={{ margin: 0 }}>
                    邮件控制台
                  </Title>
                  <Text type="secondary">集中查看域名、邮箱和邮件状态。</Text>
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
              <Space direction="vertical" size={20} style={{ width: '100%' }}>
                <Card className="hero-card">
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <div>
                      <Title level={2} style={{ margin: 0 }}>
                        收件概览
                      </Title>
                      <Paragraph className="hero-copy">
                        快速查看当前收件状态与最近内容。
                      </Paragraph>
                    </div>
                    <Space wrap size={12}>
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => setDomainModalOpen(true)}>
                        添加域名
                      </Button>
                      <Button
                        onClick={() => {
                          mailboxForm.setFieldsValue({ random: true });
                          setMailboxModalOpen(true);
                        }}
                      >
                        新建邮箱
                      </Button>
                      <Button onClick={() => setSection('messages')}>查看邮件</Button>
                    </Space>
                  </Space>
                </Card>

                <Row gutter={[16, 16]}>
                  {summaryCards.map((item) => (
                    <Col xs={24} sm={12} xl={6} key={item.title}>
                      <Card className={`summary-card ${item.accent}`}>
                        <Space direction="vertical" size={10} style={{ width: '100%' }}>
                          <div className="summary-card-head">
                            <div className="summary-card-icon">{item.icon}</div>
                            <Text type="secondary">{item.title}</Text>
                          </div>
                          <Statistic title={null} value={item.value} />
                          <Text type="secondary">{item.helper}</Text>
                        </Space>
                      </Card>
                    </Col>
                  ))}
                </Row>

                <Row gutter={[16, 16]}>
                  <Col span={24}>
                    <Card className="workspace-pulse-card" variant="borderless">
                      <Row gutter={[12, 12]}>
                        <Col xs={24} md={8}>
                          <div className="workspace-pulse-item">
                            <Text className="workspace-pulse-label">当前页面</Text>
                            <Text strong>{SECTION_OPTIONS.find((item) => item.value === section)?.label || '概览'}</Text>
                          </div>
                        </Col>
                        <Col xs={24} md={8}>
                          <div className="workspace-pulse-item">
                            <Text className="workspace-pulse-label">搜索结果</Text>
                            <Text strong>
                              域名 {filteredDomains.length} / 邮箱 {filteredMailboxes.length} / 邮件 {filteredMessages.length}
                            </Text>
                          </div>
                        </Col>
                        <Col xs={24} md={8}>
                          <div className="workspace-pulse-item">
                            <Text className="workspace-pulse-label">服务状态</Text>
                            <Text strong>{health?.ok ? '在线' : '未连接'}</Text>
                          </div>
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                  <Col xs={24} xl={15}>
                    <Card title="运行状态" extra={<Tag color="processing">实时</Tag>}>
                      <Row gutter={[16, 16]}>
                        {healthItems.map((item) => (
                          <Col xs={24} md={12} key={item.label}>
                            <div className="health-item">
                              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                <Space align="center" justify="space-between" style={{ width: '100%' }}>
                                  <Text strong>{item.label}</Text>
                                  <Tag color={item.tone}>{item.value}</Tag>
                                </Space>
                                <Text type="secondary">{item.description}</Text>
                                <Progress percent={item.progress ?? 0} size="small" showInfo={false} />
                              </Space>
                            </div>
                          </Col>
                        ))}
                      </Row>
                    </Card>
                  </Col>

                  <Col xs={24} xl={9}>
                    <Card title="最近内容" extra={<Tag color="geekblue">Latest</Tag>}>
                      <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        <div className="resource-item">
                          <div className="resource-item-head">
                            <Text type="secondary">最新域名</Text>
                            <Tag color="blue">Domain</Tag>
                          </div>
                          <Text strong>{latestDomain?.domain || '暂无域名'}</Text>
                          <Text type="secondary">
                            {latestDomain
                              ? `DNS 记录 ${latestDomain.dnsRecords?.length || 0} 条`
                              : '暂无内容'}
                          </Text>
                        </div>
                        <Divider style={{ margin: 0 }} />
                        <div className="resource-item">
                          <div className="resource-item-head">
                            <Text type="secondary">最新邮箱</Text>
                            <Tag color="purple">Mailbox</Tag>
                          </div>
                          <Text strong>{latestMailbox?.address || '暂无邮箱'}</Text>
                          <Text type="secondary">
                            {latestMailbox ? `来源：${latestMailbox.source}` : '暂无内容'}
                          </Text>
                        </div>
                        <Divider style={{ margin: 0 }} />
                        <div className="resource-item">
                          <div className="resource-item-head">
                            <Text type="secondary">最近邮件</Text>
                            <Tag color="cyan">Message</Tag>
                          </div>
                          <Text strong>{latestMessage?.subject || '暂无邮件'}</Text>
                          <Text type="secondary">
                            {latestMessage
                              ? `${latestMessage.fromAddress || latestMessage.envelopeFrom || '-'} · ${formatDateTime(latestMessage.receivedAt)}`
                              : '暂无内容'}
                          </Text>
                        </div>
                      </Space>
                    </Card>
                  </Col>
                </Row>

                <Row gutter={[16, 16]}>
                  <Col xs={24} xl={13}>
                    <Card
                      title="最近邮件"
                      extra={
                        <Button type="link" onClick={() => setSection('messages')}>
                          查看全部
                        </Button>
                      }
                    >
                      {filteredMessages.length === 0 ? (
                        <Empty description="当前还没有收件记录" />
                      ) : (
                        <Space direction="vertical" size={12} style={{ width: '100%' }}>
                          {filteredMessages.slice(0, 3).map((item) => (
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

                  <Col xs={24} xl={11}>
                    <Card title="简单流程" extra={<Tag color="gold">Guide</Tag>}>
                      <List
                        split={false}
                        dataSource={[
                          '添加域名',
                          '创建邮箱',
                          '查看收件',
                        ]}
                        renderItem={(item, index) => (
                          <List.Item className="guide-item">
                            <Space align="start">
                              <Avatar size={28} className="guide-avatar">
                                {index + 1}
                              </Avatar>
                              <Text>{item}</Text>
                            </Space>
                          </List.Item>
                        )}
                      />
                    </Card>
                  </Col>
                </Row>
              </Space>
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
                        <Button
                          onClick={() => {
                            mailboxForm.setFieldsValue({ random: true });
                            setMailboxModalOpen(true);
                          }}
                        >
                          随机生成邮箱
                        </Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setMailboxModalOpen(true)}>
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

      <Modal
        title="创建邮箱"
        open={mailboxModalOpen}
        forceRender
        confirmLoading={submitting}
        onCancel={() => setMailboxModalOpen(false)}
        onOk={() => mailboxForm.submit()}
      >
        <Form
          form={mailboxForm}
          layout="vertical"
          initialValues={{ random: false }}
          onFinish={handleCreateMailbox}
        >
          <Form.Item
            label="所属域名"
            name="domainId"
            rules={[{ required: true, message: '请选择域名' }]}
          >
            <Select
              placeholder="选择域名"
              options={domains.map((item) => ({
                label: item.domain,
                value: item.id,
              }))}
            />
          </Form.Item>

          <Form.Item label="生成方式" name="random">
            <Select
              options={[
                { label: '自定义前缀', value: false },
                { label: '随机前缀', value: true },
              ]}
            />
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) =>
              !getFieldValue('random') ? (
                <Form.Item
                  label="邮箱前缀"
                  name="localPart"
                  rules={[{ required: true, message: '请输入邮箱前缀' }]}
                >
                  <Input placeholder="support / sales / dev" />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>

      <DomainDetailDrawer
        open={domainDrawerOpen}
        domainDetail={domainDetail}
        onClose={() => setDomainDrawerOpen(false)}
        formatDateTime={formatDateTime}
      />

      <Drawer
        title="邮件详情"
        width={760}
        open={messageDrawerOpen}
        onClose={() => setMessageDrawerOpen(false)}
        extra={
          messageDetail ? (
            <Popconfirm title="确认删除这封邮件？" onConfirm={() => handleDeleteMessage(messageDetail.id)}>
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
    </Layout>
  );
}