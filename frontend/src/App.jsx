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
import MessageDetailDrawer from './components/MessageDetailDrawer.jsx';
import MessagePreviewCard from './components/MessagePreviewCard.jsx';
import {
  formatDateTime,
  formatRelativeTime,
  getRetentionLabel,
} from './app-helpers.js';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

const SECTION_DEFINITIONS = [
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
  domains: {
    title: '域名',
    description: '查看域名接入与 DNS 进度',
    searchPlaceholder: '搜索域名或备注',
  },
  mailboxes: {
    title: '邮箱',
    description: '管理收件地址与保留策略',
    searchPlaceholder: '搜索邮箱地址或域名',
  },
  messages: {
    title: '邮件',
    description: '集中查看邮件与详情',
    searchPlaceholder: '搜索主题、发件人、收件地址',
  },
  api: {
    title: 'API',
    description: '管理 Token 与接口说明',
    searchPlaceholder: '搜索 Token 或接口说明',
  },
};

const API_EXAMPLE_BASE_URL = `${typeof window !== 'undefined' ? window.location.origin : 'https://mail.example.com'}/api`;

const API_ENDPOINTS = [
  {
    key: 'list-mailboxes',
    title: '查询邮箱列表',
    endpoint: 'GET /api/mailboxes',
    summary: '获取所有邮箱列表，返回邮箱地址、域名、邮件数等信息。',
    usage: [
      '使用 Bearer Token 认证即可查询所有邮箱。',
      '返回的 items 数组包含每个邮箱的详细信息。',
      '从返回结果中获取邮箱 address，用于后续查询邮件列表。',
    ],
    example: `curl ${API_EXAMPLE_BASE_URL}/mailboxes \\
  -H "Authorization: Bearer <token>"`,
  },
  {
    key: 'create-mailbox',
    title: '创建邮箱',
    endpoint: 'POST /api/mailboxes',
    summary: '通过 Bearer Token 创建邮箱，支持手动前缀或随机前缀。',
    usage: [
      '请求头携带 Authorization: Bearer <token>。',
      '请求体直接传入 domain；如需固定前缀再补充 localPart。',
      'random=true 时由系统自动生成前缀。',
    ],
    example: `curl -X POST ${API_EXAMPLE_BASE_URL}/mailboxes \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <token>" \\
  -d '{"domain":"example.com","localPart":"test","random":false}'`,
  },
  {
    key: 'delete-mailbox',
    title: '删除邮箱',
    endpoint: 'DELETE /api/mailboxes/:address',
    summary: '通过 Bearer Token 删除指定邮箱。',
    usage: [
      '直接使用完整邮箱地址作为路径参数，调用前请做 URL 编码。',
      '删除后该邮箱后续将不再接收邮件。',
    ],
    example: `curl -X DELETE ${API_EXAMPLE_BASE_URL}/mailboxes/<encodedAddress> \\
  -H "Authorization: Bearer <token>"`,
  },
  {
    key: 'messages',
    title: '邮件列表',
    endpoint: 'GET /api/mailboxes/:address/messages',
    summary: '按邮箱地址获取完整邮件列表。',
    usage: [
      '直接使用完整邮箱地址作为路径参数，调用前请做 URL 编码。',
      '返回 items 数组，可继续提取 messageId 查看详情。',
    ],
    example: `curl ${API_EXAMPLE_BASE_URL}/mailboxes/<encodedAddress>/messages \\
  -H "Authorization: Bearer <token>"`,
  },
  {
    key: 'latest',
    title: '最新邮件',
    endpoint: 'GET /api/mailboxes/:address/messages?latest=1',
    summary: '只返回最新一封邮件，适合轮询或快速检查。',
    usage: [
      '在按邮箱地址查询的基础上增加 latest=1 查询参数。',
      '返回的 items 最多只有一条记录。',
    ],
    example: `curl ${API_EXAMPLE_BASE_URL}/mailboxes/<encodedAddress>/messages?latest=1 \\
  -H "Authorization: Bearer <token>"`,
  },
  {
    key: 'detail',
    title: '邮件详情',
    endpoint: 'GET /api/messages/:messageId',
    summary: '根据 messageId 获取单封邮件详情。',
    usage: [
      'messageId 通常来自邮件列表返回结果。',
      '适合获取完整正文、头信息与附件元数据。',
    ],
    example: `curl ${API_EXAMPLE_BASE_URL}/messages/<messageId> \\
  -H "Authorization: Bearer <token>"`,
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

function SectionHero({
  title,
  description,
  actions = null,
  searchPlaceholder = '',
  searchValue = '',
  onSearchChange = null,
}) {
  return (
    <Card className="section-intro-card page-toolbar-card">
      <div className="section-hero-layout">
        <div className="section-hero-main">
          <Space direction="vertical" size={4}>
            <Title level={4} style={{ margin: 0 }}>
              {title}
            </Title>
            {description ? <Text type="secondary">{description}</Text> : null}
          </Space>
        </div>

        {(onSearchChange || actions) ? (
          <div className="section-hero-toolbar">
            {onSearchChange ? (
              <Input
                aria-label={`${title}搜索`}
                placeholder={searchPlaceholder}
                prefix={<SearchOutlined />}
                allowClear
                className="section-hero-search"
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            ) : null}
            {actions ? <div className="section-hero-actions">{actions}</div> : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export default function App({ adminProfile = null, onLogout = null }) {
  const { message } = AntdApp.useApp();
  const [section, setSection] = useState('domains');
  const [loading, setLoading] = useState(false);
  const [domains, setDomains] = useState([]);
  const [mailboxes, setMailboxes] = useState([]);
  const [selectedMailboxAddress, setSelectedMailboxAddress] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageDetail, setMessageDetail] = useState(null);
  const [domainModalOpen, setDomainModalOpen] = useState(false);
  const [domainDrawerOpen, setDomainDrawerOpen] = useState(false);
  const [domainDetail, setDomainDetail] = useState(null);
  const [domainDnsStatus, setDomainDnsStatus] = useState({});
  const [mailboxModalOpen, setMailboxModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sectionSearchText, setSectionSearchText] = useState({
    domains: '',
    mailboxes: '',
    messages: '',
    api: '',
  });
  const [apiTokens, setApiTokens] = useState([]);
  const [newApiToken, setNewApiToken] = useState(null);
  const [apiEndpointKey, setApiEndpointKey] = useState('messages');
  const [domainForm] = Form.useForm();
  const [mailboxForm] = Form.useForm();
  const [retentionForm] = Form.useForm();
  const [apiTokenForm] = Form.useForm();

  const unreadCount = useMemo(
    () => messages.filter((item) => !item.isRead).length,
    [messages],
  );

  const hasDomains = domains.length > 0;
  const hasMailboxes = mailboxes.length > 0;
  const sectionOptions = useMemo(() => buildSectionOptions(section), [section]);
  const activeApiEndpoint = API_ENDPOINTS.find((item) => item.key === apiEndpointKey) ?? API_ENDPOINTS[0];

  const normalizedSectionSearch = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(sectionSearchText).map(([key, value]) => [key, value.trim().toLowerCase()]),
      ),
    [sectionSearchText],
  );

  const filteredDomains = useMemo(() => {
    const keyword = normalizedSectionSearch.domains;
    if (!keyword) {
      return domains;
    }

    return domains.filter(
      (item) => item.domain.toLowerCase().includes(keyword) || (item.note || '').toLowerCase().includes(keyword),
    );
  }, [domains, normalizedSectionSearch.domains]);

  const filteredMailboxes = useMemo(() => {
    const keyword = normalizedSectionSearch.mailboxes;
    if (!keyword) {
      return mailboxes;
    }

    return mailboxes.filter(
      (item) => item.address.toLowerCase().includes(keyword) || item.domain.toLowerCase().includes(keyword),
    );
  }, [mailboxes, normalizedSectionSearch.mailboxes]);

  const filteredMessages = useMemo(() => {
    const keyword = normalizedSectionSearch.messages;
    if (!keyword) {
      return messages;
    }

    return messages.filter(
      (item) =>
        (item.subject || '').toLowerCase().includes(keyword) ||
        (item.fromAddress || '').toLowerCase().includes(keyword) ||
        (item.envelopeTo || '').toLowerCase().includes(keyword),
    );
  }, [messages, normalizedSectionSearch.messages]);

  const filteredApiTokens = useMemo(() => {
    const keyword = normalizedSectionSearch.api;
    if (!keyword) {
      return apiTokens;
    }

    return apiTokens.filter(
      (item) =>
        (item.name || '').toLowerCase().includes(keyword) ||
        (item.tokenPrefix || '').toLowerCase().includes(keyword),
    );
  }, [apiTokens, normalizedSectionSearch.api]);

  const filteredApiEndpoints = useMemo(() => {
    const keyword = normalizedSectionSearch.api;
    if (!keyword) {
      return API_ENDPOINTS;
    }

    return API_ENDPOINTS.filter(
      (item) =>
        item.title.toLowerCase().includes(keyword) ||
        item.endpoint.toLowerCase().includes(keyword) ||
        item.summary.toLowerCase().includes(keyword) ||
        item.usage.some((usageItem) => usageItem.toLowerCase().includes(keyword)),
    );
  }, [normalizedSectionSearch.api]);

  useEffect(() => {
    if (!filteredApiEndpoints.some((item) => item.key === apiEndpointKey)) {
      setApiEndpointKey(filteredApiEndpoints[0]?.key ?? API_ENDPOINTS[0].key);
    }
  }, [apiEndpointKey, filteredApiEndpoints]);

  function updateSectionSearch(sectionKey, value) {
    setSectionSearchText((current) => ({
      ...current,
      [sectionKey]: value,
    }));
  }

  const selectedMailbox = mailboxes.find((item) => item.address === selectedMailboxAddress) || null;

  const loadMessages = useCallback(
    async (mailboxAddress, options = {}) => {
      const { keepSection = false, silent = false } = options;

      if (!mailboxAddress) {
        setMessages([]);
        setSelectedMailboxAddress(null);
        return;
      }

      try {
        if (!silent) {
          setLoading(true);
        }
        const response = await getMailboxMessages(mailboxAddress);
        setSelectedMailboxAddress(mailboxAddress);
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
      const [domainsResponse, mailboxesResponse, apiTokensResponse] = await Promise.all([
        getDomains(),
        getMailboxes(),
        getApiTokens(),
      ]);

      const nextDomains = domainsResponse.items ?? [];
      const nextMailboxes = mailboxesResponse.items ?? [];
      const nextApiTokens = apiTokensResponse.items ?? [];
      setDomains(nextDomains);
      setMailboxes(nextMailboxes);
      setApiTokens(nextApiTokens);

      const nextMailboxAddress =
        selectedMailboxAddress && nextMailboxes.some((item) => item.address === selectedMailboxAddress)
          ? selectedMailboxAddress
          : nextMailboxes[0]?.address;

      if (nextMailboxAddress) {
        const messageResponse = await getMailboxMessages(nextMailboxAddress);
        setSelectedMailboxAddress(nextMailboxAddress);
        setMessages(messageResponse.items ?? []);
      } else {
        setSelectedMailboxAddress(null);
        setMessages([]);
      }

      const selectedMailboxRecord = nextMailboxes.find((item) => item.address === nextMailboxAddress);

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
    if (!selectedMailboxAddress) {
      return undefined;
    }

    loadMessages(selectedMailboxAddress, {
      keepSection: true,
      silent: true,
    });

    const pollTimer = window.setInterval(() => {
      loadMessages(selectedMailboxAddress, {
        keepSection: true,
        silent: true,
      });
    }, 5000);

    return () => {
      window.clearInterval(pollTimer);
    };
  }, [loadMessages, selectedMailboxAddress, section]);

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
        note: values.note || '',
      });
      const createdDomain = createdResponse?.item ?? null;

      await loadData();

      if (createdDomain?.id) {
        await handleDetectDomainDns(createdDomain.id, { silent: true });
      }

      message.success('域名已创建，已自动开始真实 DNS 检测并校验 MX 配置');
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
        domain: values.domain,
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

  async function handleDeleteMailbox(address) {
    try {
      await deleteMailbox(address);
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

      if (selectedMailboxAddress) {
        await loadMessages(selectedMailboxAddress, { keepSection: true });
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
    if (!selectedMailboxAddress) {
      message.warning('请先选择邮箱');
      return;
    }

    try {
      const payload = {
        retentionValue: values.retentionValue ? Number(values.retentionValue) : null,
        retentionUnit: values.retentionValue ? values.retentionUnit : null,
      };

      await updateMailboxRetention(selectedMailboxAddress, payload);
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
        <Space direction="vertical" size={2} className="mailbox-table-cell-stack">
          <Text strong className="mailbox-table-primary-text">{value}</Text>
          <Text type="secondary" className="mailbox-table-secondary-text">域名：{record.domain}</Text>
        </Space>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      render: (value) => (
        <div className="mailbox-table-single-line">
          <Tag color={value === 'random' ? 'blue' : 'purple'} className="mailbox-table-inline-tag">{value}</Tag>
        </div>
      ),
    },
    {
      title: '最近收件',
      dataIndex: 'latestReceivedAt',
      key: 'latestReceivedAt',
      render: (value) => (
        <Space direction="vertical" size={2} className="mailbox-table-cell-stack">
          <Text className="mailbox-table-primary-text">{formatDateTime(value)}</Text>
          <Text type="secondary" className="mailbox-table-secondary-text">{formatRelativeTime(value)}</Text>
        </Space>
      ),
    },
    {
      title: '邮件数',
      dataIndex: 'messageCount',
      key: 'messageCount',
      width: 90,
      render: (value) => (
        <div className="mailbox-table-single-line">
          <Badge count={value} showZero color="#1677ff" />
        </div>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 170,
      render: (_, record) => (
        <Space className="mailbox-action-group" size={[12, 8]} wrap>
          <Button type="link" className="mailbox-action-link" onClick={() => loadMessages(record.address, { keepSection: false })}>
            查看邮件
          </Button>
          <Popconfirm title="确认删除该邮箱？" onConfirm={() => handleDeleteMailbox(record.address)}>
            <Button danger type="text" icon={<DeleteOutlined />} className="mailbox-action-danger" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const domainOptions = domains.map((item) => ({
    label: item.domain,
    value: item.domain,
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
      domain: defaults.domain ?? domains[0]?.domain,
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
          <div className="app-header-main">
            <div className="app-header-surface app-header-surface-compact">
              <div className="header-global-actions">
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
          </div>
        </Header>

        <Content className="app-content">
          <Spin spinning={loading}>
            {section === 'domains' && (
              <DomainTableSection
                domains={filteredDomains}
                domainDnsStatus={domainDnsStatus}
                formatDateTime={formatDateTime}
                searchText={sectionSearchText.domains}
                onSearchChange={(value) => updateSectionSearch('domains', value)}
                onCreateDomain={() => setDomainModalOpen(true)}
                onDeleteDomain={handleDeleteDomain}
                onOpenDetail={handleOpenDomainDetail}
              />
            )}

            {section === 'mailboxes' && (
              <Space direction="vertical" size={16} style={{ width: '100%' }} className="page-section">
                <SectionHero
                  title="邮箱管理"
                  description="为域名创建收件地址，并管理自动清理策略。"
                  searchPlaceholder={SECTION_META.mailboxes.searchPlaceholder}
                  searchValue={sectionSearchText.mailboxes}
                  onSearchChange={(value) => updateSectionSearch('mailboxes', value)}
                  actions={(
                    <Space wrap>
                      <Button onClick={() => openMailboxModal({ random: true })} disabled={!hasDomains}>
                        随机邮箱
                      </Button>
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => openMailboxModal({ random: false })} disabled={!hasDomains}>
                        创建邮箱
                      </Button>
                    </Space>
                  )}
                />

                <Card className="mailbox-table-card">
                  <Table
                    className="mailbox-table"
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
                      ? '查看当前邮件内容并快速返回列表。'
                      : '按邮箱集中查看最新邮件与未读状态。'
                  }
                  searchPlaceholder={messageDetail ? '' : SECTION_META.messages.searchPlaceholder}
                  searchValue={messageDetail ? '' : sectionSearchText.messages}
                  onSearchChange={messageDetail ? null : (value) => updateSectionSearch('messages', value)}
                  actions={
                    messageDetail ? null : (
                      <Select
                        aria-label="选择邮箱"
                        value={selectedMailboxAddress}
                        onChange={(value) => loadMessages(value, { keepSection: true })}
                        className="mailbox-selector"
                        placeholder="选择邮箱"
                        options={mailboxes.map((item) => ({
                          label: item.address,
                          value: item.address,
                        }))}
                      />
                    )
                  }
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
                <SectionHero
                  title="API 说明"
                  description="保留 Token 管理、接口清单与 curl 示例；示例地址会自动跟随当前站点域名生成。"
                  searchPlaceholder={SECTION_META.api.searchPlaceholder}
                  searchValue={sectionSearchText.api}
                  onSearchChange={(value) => updateSectionSearch('api', value)}
                  actions={<Tag color="blue">{filteredApiEndpoints.length} 个匹配接口</Tag>}
                />

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
                      <Text type="secondary">
                        请立即复制保存。页面不再内置调试请求能力，如需使用请将该 Token 带入下方示例命令。
                      </Text>
                    </Space>
                  </Card>
                ) : null}

                <Row gutter={[16, 16]} align="top">
                  <Col xs={24} xl={10}>
                    <Card title="Token 管理" className="api-card">
                      <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        <Form form={apiTokenForm} layout="vertical" onFinish={handleCreateApiToken}>
                          <Form.Item
                            label="新建 Token"
                            name="name"
                            rules={[{ required: true, message: '请输入 Token 名称' }]}
                          >
                            <Input
                              aria-label="Token 名称"
                              placeholder="例如：mailbox-readonly"
                              maxLength={120}
                            />
                          </Form.Item>
                          <Button type="primary" htmlType="submit" loading={submitting} block>
                            创建 Token
                          </Button>
                        </Form>

                        <div className="api-auth-panel">
                          <div className="api-auth-panel-head">
                            <Text strong>请求头格式</Text>
                            <Tag color="processing">Bearer</Tag>
                          </div>
                          <pre className="message-code-block api-code-block">
Authorization: Bearer {'<token>'}
                          </pre>
                        </div>

                        <div className="api-create-tips">
                          <Text strong className="api-tips-title">
                            使用前准备
                          </Text>
                          <List
                            split={false}
                            dataSource={[
                              '先登录后台并创建一个 API Token。',
                              'domain 直接填写已创建的域名字符串，例如 example.com。',
                              '邮箱地址可通过"查询邮箱列表"接口获取，并在路径中做 URL 编码。',
                              'messageId 需从邮件列表接口返回结果中获取。',
                              '页面仅提供说明和示例，实际调用请在终端、脚本或你的客户端中完成。',
                            ]}
                            renderItem={(item) => <List.Item className="guide-item">{item}</List.Item>}
                          />
                        </div>
                      </Space>
                    </Card>
                  </Col>

                  <Col xs={24} xl={14}>
                    <Card title="接口清单与用法" className="api-card">
                      <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        <Form layout="vertical">
                          <Form.Item label="接口选择">
                            <Segmented
                              block
                              value={apiEndpointKey}
                              onChange={setApiEndpointKey}
                              options={filteredApiEndpoints.map((item) => ({
                                label: item.title,
                                value: item.key,
                              }))}
                            />
                          </Form.Item>
                        </Form>

                        <Card size="small" className="api-endpoint-preview">
                          <Space direction="vertical" size={8} style={{ width: '100%' }}>
                            <Text strong>{activeApiEndpoint.title}</Text>
                            <pre className="message-code-block api-code-block">{activeApiEndpoint.endpoint}</pre>
                            <Text type="secondary">{activeApiEndpoint.summary}</Text>
                          </Space>
                        </Card>

                        <div className="api-create-tips">
                          <Text strong className="api-tips-title">
                            调用说明
                          </Text>
                          <List
                            split={false}
                            dataSource={activeApiEndpoint.usage}
                            renderItem={(item) => <List.Item className="guide-item">{item}</List.Item>}
                          />
                        </div>

                        <Card size="small" title="curl 示例">
                          <pre className="message-code-block api-code-block">{activeApiEndpoint.example}</pre>
                        </Card>
                      </Space>
                    </Card>
                  </Col>
                </Row>

                <Card title="已有 Token" className="api-card api-token-table-card">
                  <Table
                    rowKey="id"
                    columns={apiTokenColumns}
                    dataSource={filteredApiTokens}
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
            domain: domainDetail?.domain,
          });
        }}
        formatDateTime={formatDateTime}
      />

    </Layout>
  );
}