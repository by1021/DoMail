import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App as AntdApp,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
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
  DeleteOutlined,
  LogoutOutlined,
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
  updateMailboxMessageRetention,
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
import {
  filterByKeyword,
  normalizeSearchKeyword,
} from './app-view-helpers.js';
import {
  API_ENDPOINTS,
  SECTION_META,
  buildSectionOptions,
} from './app-config.jsx';

const { Content, Sider } = Layout;
const { Title, Text } = Typography;

function WorkspaceBrand({ loading = false, onRefresh = null, onLogout = null }) {
  return (
    <div className="brand-block">
      <div className="brand-surface">
        <Space
          direction="vertical"
          size={14}
          style={{ width: '100%' }}
          align="center"
          className="brand-stack"
        >
          <Avatar size={56} icon={<ThunderboltOutlined />} className="app-brand-logo" />
          <div className="brand-copy">
            <Title level={4} className="app-brand-title" style={{ margin: 0 }}>
              域名邮箱
            </Title>
            <Text type="secondary">DoMail</Text>
          </div>
          <Space size={[10, 10]} wrap className="brand-action-group brand-action-group-inline">
            <Button
              icon={<ReloadOutlined />}
              className="domain-action-button brand-action-button"
              onClick={onRefresh}
              loading={loading}
            >
              刷新
            </Button>
            <Button
              danger
              icon={<LogoutOutlined />}
              className="domain-action-button domain-action-button-danger brand-action-button"
              onClick={onLogout}
              disabled={!onLogout}
            >
              退出登录
            </Button>
          </Space>
        </Space>
      </div>
    </div>
  );
}

function SectionHero({
  title = '搜索',
  actions = null,
  searchPlaceholder = '',
  searchValue = '',
  onSearchChange = null,
}) {
  if (!onSearchChange && !actions) {
    return null;
  }

  return (
    <Card className="page-toolbar-card page-toolbar-card-minimal page-section-toolbar-card">
      <div className="section-hero-toolbar section-hero-toolbar-responsive page-section-toolbar">
        <div className="section-hero-search-slot section-hero-search-slot-responsive">
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
        </div>
        <div className="section-hero-actions-slot section-hero-actions-slot-responsive">
          {actions ? <div className="section-hero-actions section-hero-actions-responsive">{actions}</div> : null}
        </div>
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
  const [mailboxBatchSubmitting, setMailboxBatchSubmitting] = useState(false);
  const [selectedMailboxRowKeys, setSelectedMailboxRowKeys] = useState([]);
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
  const [bulkRetentionForm] = Form.useForm();
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
        Object.entries(sectionSearchText).map(([key, value]) => [key, normalizeSearchKeyword(value)]),
      ),
    [sectionSearchText],
  );

  const filteredDomains = useMemo(
    () =>
      filterByKeyword(
        domains,
        normalizedSectionSearch.domains,
        (item, keyword) =>
          item.domain.toLowerCase().includes(keyword) || (item.note || '').toLowerCase().includes(keyword),
      ),
    [domains, normalizedSectionSearch.domains],
  );

  const filteredMailboxes = useMemo(
    () =>
      filterByKeyword(
        mailboxes,
        normalizedSectionSearch.mailboxes,
        (item, keyword) =>
          item.address.toLowerCase().includes(keyword) || item.domain.toLowerCase().includes(keyword),
      ),
    [mailboxes, normalizedSectionSearch.mailboxes],
  );

  const selectedMailboxRows = useMemo(
    () => mailboxes.filter((item) => selectedMailboxRowKeys.includes(item.id)),
    [mailboxes, selectedMailboxRowKeys],
  );

  const retentionTargetMailboxes = useMemo(
    () => (selectedMailboxRows.length > 0 ? selectedMailboxRows : filteredMailboxes),
    [filteredMailboxes, selectedMailboxRows],
  );
  const messageRetentionTargetMailboxes = mailboxes;

  const messageRetentionSnapshot = useMemo(() => {
    if (mailboxes.length === 0) {
      return {
        hasMailboxes: false,
        isShared: true,
        retentionValue: null,
        retentionUnit: 'hour',
      };
    }

    const [firstMailbox] = mailboxes;
    const firstRetentionValue = firstMailbox.messageRetentionValue ?? null;
    const firstRetentionUnit = firstMailbox.messageRetentionUnit ?? null;
    const isShared = mailboxes.every(
      (item) =>
        (item.messageRetentionValue ?? null) === firstRetentionValue &&
        (item.messageRetentionUnit ?? null) === firstRetentionUnit,
    );

    return {
      hasMailboxes: true,
      isShared,
      retentionValue: isShared ? firstRetentionValue : null,
      retentionUnit: isShared ? (firstRetentionUnit ?? 'hour') : 'hour',
    };
  }, [mailboxes]);

  const filteredMessages = useMemo(
    () =>
      filterByKeyword(
        messages,
        normalizedSectionSearch.messages,
        (item, keyword) =>
          (item.subject || '').toLowerCase().includes(keyword) ||
          (item.fromAddress || '').toLowerCase().includes(keyword) ||
          (item.envelopeTo || '').toLowerCase().includes(keyword),
      ),
    [messages, normalizedSectionSearch.messages],
  );

  const filteredApiTokens = useMemo(
    () =>
      filterByKeyword(
        apiTokens,
        normalizedSectionSearch.api,
        (item, keyword) =>
          (item.name || '').toLowerCase().includes(keyword) ||
          (item.tokenPrefix || '').toLowerCase().includes(keyword),
      ),
    [apiTokens, normalizedSectionSearch.api],
  );

  const filteredApiEndpoints = useMemo(
    () =>
      filterByKeyword(
        API_ENDPOINTS,
        normalizedSectionSearch.api,
        (item, keyword) =>
          item.title.toLowerCase().includes(keyword) ||
          item.endpoint.toLowerCase().includes(keyword) ||
          item.summary.toLowerCase().includes(keyword) ||
          item.usage.some((usageItem) => usageItem.toLowerCase().includes(keyword)),
      ),
    [normalizedSectionSearch.api],
  );

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

  function formatMessageRetentionSummary(retentionValue, retentionUnit) {
    if (!retentionValue || !retentionUnit) {
      return '已关闭自动清理';
    }

    return `${retentionValue}${retentionUnit === 'day' ? '天' : '小时'}后自动清理`;
  }

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
    setSelectedMailboxRowKeys((current) =>
      current.filter((id) => mailboxes.some((item) => item.id === id)),
    );
  }, [mailboxes]);

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
      retentionValue: messageRetentionSnapshot.retentionValue,
      retentionUnit: messageRetentionSnapshot.retentionUnit,
    });
  }, [messageRetentionSnapshot, retentionForm]);

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

  async function handleBatchDeleteMailboxes() {
    if (selectedMailboxRows.length === 0) {
      message.warning('请先勾选邮箱');
      return;
    }

    try {
      setMailboxBatchSubmitting(true);
      await Promise.all(selectedMailboxRows.map((item) => deleteMailbox(item.address)));
      message.success(`已删除 ${selectedMailboxRows.length} 个邮箱`);
      setSelectedMailboxRowKeys([]);
      await loadData();
    } catch (error) {
      message.error(extractErrorMessage(error, '批量删除邮箱失败'));
    } finally {
      setMailboxBatchSubmitting(false);
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

  async function handleUpdateMessageRetention(values) {
    if (messageRetentionTargetMailboxes.length === 0) {
      message.warning('当前没有可应用邮件自动清理设置的邮箱');
      return;
    }

    try {
      setMailboxBatchSubmitting(true);

      const payload = {
        retentionValue: values.retentionValue ? Number(values.retentionValue) : null,
        retentionUnit: values.retentionValue ? values.retentionUnit : null,
      };

      await Promise.all(
        messageRetentionTargetMailboxes.map((item) => updateMailboxMessageRetention(item.address, payload)),
      );

      message.success(
        payload.retentionValue
          ? `已为 ${messageRetentionTargetMailboxes.length} 个邮箱更新邮件自动清理设置`
          : `已关闭 ${messageRetentionTargetMailboxes.length} 个邮箱的邮件自动清理`,
      );
      await loadData();
    } catch (error) {
      message.error(extractErrorMessage(error, '更新全部邮箱邮件自动清理设置失败'));
    } finally {
      setMailboxBatchSubmitting(false);
    }
  }

  async function handleBatchUpdateRetention(values, options = {}) {
    if (retentionTargetMailboxes.length === 0) {
      message.warning('当前没有可应用邮箱自动清理设置的邮箱');
      return;
    }

    const shouldClear = options.clear === true;
    const retentionValue = shouldClear ? null : (values.retentionValue ? Number(values.retentionValue) : null);
    const retentionUnit = shouldClear ? null : (values.retentionValue ? values.retentionUnit : null);

    if (!shouldClear && !retentionValue) {
      message.warning('请输入邮箱自动清理时间');
      return;
    }

    try {
      setMailboxBatchSubmitting(true);
      await Promise.all(
        retentionTargetMailboxes.map((item) =>
          updateMailboxRetention(item.address, {
            retentionValue,
            retentionUnit,
          }),
        ),
      );
      message.success(
        shouldClear
          ? `已关闭 ${retentionTargetMailboxes.length} 个邮箱的邮箱自动清理设置`
          : `已更新 ${retentionTargetMailboxes.length} 个邮箱的邮箱自动清理设置`,
      );
      await loadData();
    } catch (error) {
      message.error(extractErrorMessage(error, '批量更新邮箱自动清理设置失败'));
    } finally {
      setMailboxBatchSubmitting(false);
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
      title: '邮箱',
      dataIndex: 'address',
      key: 'address',
      width: 260,
      align: 'center',
      render: (value, record) => (
        <div className="mailbox-table-cell-stack mailbox-table-address-cell domain-table-cell-centered">
          <Space wrap size={[8, 8]} className="mailbox-table-address-head">
            <Text strong className="mailbox-table-primary-text mailbox-table-address-text">{value}</Text>
            <Tag
              color={record.source?.includes('random') ? 'blue' : 'purple'}
              className="mailbox-table-inline-tag mailbox-table-source-tag"
            >
              {record.source === 'random' ? '随机前缀' : '自定义前缀'}
            </Tag>
          </Space>
          <Text type="secondary" className="mailbox-table-secondary-text">
            域名：{record.domain}
          </Text>
        </div>
      ),
    },
    {
      title: '最近收件',
      dataIndex: 'latestReceivedAt',
      key: 'latestReceivedAt',
      width: 176,
      align: 'center',
      render: (value) => (
        <div className="mailbox-table-cell-stack mailbox-table-time-cell domain-table-cell-centered">
          <Text className="mailbox-table-primary-text">{formatDateTime(value)}</Text>
          <Text type="secondary" className="mailbox-table-secondary-text">{formatRelativeTime(value)}</Text>
        </div>
      ),
    },
    {
      title: '邮件数',
      dataIndex: 'messageCount',
      key: 'messageCount',
      width: 108,
      align: 'center',
      render: (value) => (
        <div className="mailbox-table-count-cell domain-table-cell-centered">
          <Badge count={value} showZero color="#1677ff" className="mailbox-table-count-badge" />
        </div>
      ),
    },
    {
      title: '邮箱清理',
      key: 'retention',
      width: 180,
      align: 'center',
      render: (_, record) => (
        <div className="mailbox-table-cell-stack mailbox-table-retention-cell domain-table-cell-centered">
          <Text className="mailbox-table-primary-text">{getRetentionLabel(record)}</Text>
          <Text type="secondary" className="mailbox-table-secondary-text">
            {record.retentionValue ? '到期后自动删除该邮箱' : '当前未启用'}
          </Text>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 192,
      align: 'center',
      render: (_, record) => (
        <div className="domain-action-group domain-action-group-inline domain-action-group-compact domain-action-group-centered mailbox-action-group">
          <Button
            type="default"
            className="domain-action-button domain-action-button-accent domain-action-button-compact"
            onClick={() => loadMessages(record.address, { keepSection: false })}
          >
            查看邮件
          </Button>
          <Popconfirm title="确认删除该邮箱？" onConfirm={() => handleDeleteMailbox(record.address)}>
            <Button
              danger
              type="default"
              icon={<DeleteOutlined />}
              className="domain-action-button domain-action-button-danger domain-action-button-compact"
            >
              删除
            </Button>
          </Popconfirm>
        </div>
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
    mailboxForm.resetFields();
    mailboxForm.setFieldsValue({
      domain: defaults.domain ?? domains[0]?.domain,
      random: false,
      ...defaults,
    });
    setMailboxModalOpen(true);
  }

  function handleCloseMailboxModal() {
    setMailboxModalOpen(false);
    mailboxForm.resetFields();
  }

  const mailboxRowSelection = {
    selectedRowKeys: selectedMailboxRowKeys,
    onChange: setSelectedMailboxRowKeys,
  };

  const isBatchRetentionUsingSelection = selectedMailboxRows.length > 0;

  return (
    <Layout className="app-shell app-shell-responsive">
      <Sider width={320} theme="light" breakpoint="lg" collapsedWidth="0" className="app-sider">
        <WorkspaceBrand loading={loading} onRefresh={loadData} onLogout={onLogout} />

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
              <Space
                direction="vertical"
                size={16}
                style={{ width: '100%' }}
                className="page-section page-section-mailboxes"
              >
                <SectionHero
                  title="邮箱"
                  searchPlaceholder={SECTION_META.mailboxes.searchPlaceholder}
                  searchValue={sectionSearchText.mailboxes}
                  onSearchChange={(value) => updateSectionSearch('mailboxes', value)}
                  actions={(
                    <div className="domain-table-toolbar-actions mailbox-section-hero-actions mailbox-section-hero-actions-compact mailbox-section-hero-actions-responsive">
                      <Button
                        className="domain-action-button domain-action-button-compact"
                        onClick={() => openMailboxModal({ random: true })}
                        disabled={!hasDomains}
                      >
                        随机邮箱
                      </Button>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        className="domain-action-button domain-action-button-accent domain-action-button-compact"
                        onClick={() => openMailboxModal({ random: false })}
                        disabled={!hasDomains}
                      >
                        创建邮箱
                      </Button>
                    </div>
                  )}
                />

                <Card
                  className="mailbox-toolbar-card mailbox-toolbar-card-responsive page-section-panel page-section-panel-subtle"
                  title="批量操作"
                >
                  <div className="mailbox-toolbar-layout mailbox-toolbar-layout-responsive">
                    <div className="mailbox-toolbar-main">
                      <div className="mailbox-toolbar-inline-copy">
                        <Text strong>
                          {isBatchRetentionUsingSelection
                            ? `已选 ${retentionTargetMailboxes.length} 个邮箱`
                            : `当前列表 ${retentionTargetMailboxes.length} 个邮箱`}
                        </Text>
                        <Text type="secondary">
                          未勾选时默认作用于当前列表；删除仅对勾选项生效。
                        </Text>
                      </div>

                      <Form
                        form={bulkRetentionForm}
                        layout="inline"
                        initialValues={{ retentionValue: null, retentionUnit: 'hour' }}
                        onFinish={handleBatchUpdateRetention}
                        className="retention-form mailbox-inline-retention-form mailbox-inline-retention-form-responsive"
                      >
                        <Form.Item name="retentionValue">
                          <Input
                            aria-label="批量邮箱自动清理时间"
                            type="number"
                            min={1}
                            placeholder="清理时间"
                          />
                        </Form.Item>
                        <Form.Item name="retentionUnit">
                          <Select
                            aria-label="批量邮箱自动清理时间单位"
                            options={[
                              { label: '小时', value: 'hour' },
                              { label: '天', value: 'day' },
                            ]}
                          />
                        </Form.Item>
                      </Form>
                    </div>

                    <Space
                      wrap
                      size={[10, 10]}
                      className="mailbox-toolbar-inline-actions mailbox-toolbar-inline-actions-responsive"
                    >
                      <Button
                        type="primary"
                        className="domain-action-button domain-action-button-accent"
                        onClick={() => bulkRetentionForm.submit()}
                        disabled={retentionTargetMailboxes.length === 0}
                        loading={mailboxBatchSubmitting}
                      >
                        保存清理
                      </Button>
                      <Button
                        className="domain-action-button"
                        onClick={() => handleBatchUpdateRetention(bulkRetentionForm.getFieldsValue(), { clear: true })}
                        disabled={retentionTargetMailboxes.length === 0}
                        loading={mailboxBatchSubmitting}
                      >
                        关闭清理
                      </Button>
                      <Button
                        className="domain-action-button"
                        onClick={() => setSection('messages')}
                        disabled={!hasMailboxes}
                      >
                        打开收件区
                      </Button>
                      <Popconfirm
                        title={`确认删除已选中的 ${selectedMailboxRowKeys.length} 个邮箱？`}
                        onConfirm={handleBatchDeleteMailboxes}
                        disabled={selectedMailboxRowKeys.length === 0}
                      >
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          className="domain-action-button domain-action-button-danger"
                          disabled={selectedMailboxRowKeys.length === 0}
                          loading={mailboxBatchSubmitting}
                        >
                          批量删除
                        </Button>
                      </Popconfirm>
                    </Space>
                  </div>
                </Card>

                <Card className="mailbox-table-card mailbox-table-card-responsive page-section-panel">
                  <Table
                    className="mailbox-table mailbox-table-responsive"
                    rowKey="id"
                    rowSelection={mailboxRowSelection}
                    columns={mailboxColumns}
                    dataSource={filteredMailboxes}
                    locale={{ emptyText: '暂无邮箱，请先创建域名后新增邮箱。' }}
                    pagination={false}
                    scroll={{ x: 760 }}
                  />
                </Card>
              </Space>
            )}

            {section === 'messages' && (
              <Space
                direction="vertical"
                size={16}
                style={{ width: '100%' }}
                className="page-section page-section-messages"
              >
                <SectionHero
                  title="邮件"
                  searchPlaceholder={messageDetail ? '' : SECTION_META.messages.searchPlaceholder}
                  searchValue={messageDetail ? '' : sectionSearchText.messages}
                  onSearchChange={messageDetail ? null : (value) => updateSectionSearch('messages', value)}
                  actions={
                    messageDetail ? null : (
                      <div className="domain-table-toolbar-actions mailbox-section-hero-actions mailbox-section-hero-actions-compact mailbox-section-hero-actions-responsive">
                        <Select
                          aria-label="选择邮箱"
                          value={selectedMailboxAddress}
                          onChange={(value) => loadMessages(value, { keepSection: true })}
                          className="mailbox-selector mailbox-selector-responsive"
                          placeholder="选择邮箱"
                          options={mailboxes.map((item) => ({
                            label: item.address,
                            value: item.address,
                          }))}
                        />
                      </div>
                    )
                  }
                />

                {messageDetail ? (
                  <div className="message-detail-layout message-detail-layout-responsive">
                    <MessageDetailDrawer
                      messageDetail={messageDetail}
                      onDeleteMessage={handleDeleteMessage}
                      onBack={handleBackToMessageList}
                      formatDateTime={formatDateTime}
                    />
                  </div>
                ) : (
                  <Space
                    direction="vertical"
                    size={16}
                    style={{ width: '100%' }}
                    className="message-section-content message-section-content-responsive"
                  >
                    <Card
                      title="全部邮箱邮件自动清理"
                      className="mailbox-toolbar-card mailbox-toolbar-card-responsive page-section-panel page-section-panel-subtle message-toolbar-card"
                      extra={
                        <Tag color={messageRetentionTargetMailboxes.length > 0 ? 'processing' : 'default'}>
                          {messageRetentionTargetMailboxes.length} 个邮箱
                        </Tag>
                      }
                    >
                      {messageRetentionSnapshot.hasMailboxes ? (
                        <div className="mailbox-toolbar-layout mailbox-toolbar-layout-responsive message-toolbar-layout">
                          <div className="mailbox-toolbar-main message-toolbar-main">
                            <div className="mailbox-toolbar-inline-copy message-toolbar-inline-copy message-retention-copy-compact">
                              <Text strong>统一作用于全部邮箱</Text>
                              <Text type="secondary">
                                当前：{messageRetentionSnapshot.isShared
                                  ? formatMessageRetentionSummary(
                                      messageRetentionSnapshot.retentionValue,
                                      messageRetentionSnapshot.retentionUnit,
                                    )
                                  : '各邮箱设置不一致'}
                              </Text>
                            </div>

                            <Form
                              form={retentionForm}
                              layout="inline"
                              onFinish={handleUpdateMessageRetention}
                              initialValues={{ retentionValue: null, retentionUnit: 'hour' }}
                              className="retention-form mailbox-inline-retention-form message-retention-inline-form message-retention-inline-form-responsive"
                            >
                              <Form.Item name="retentionValue">
                                <Input
                                  aria-label="全部邮箱邮件自动清理时间"
                                  type="number"
                                  min={1}
                                  placeholder="清理时间"
                                />
                              </Form.Item>
                              <Form.Item name="retentionUnit">
                                <Select
                                  aria-label="全部邮箱邮件自动清理时间单位"
                                  options={[
                                    { label: '小时', value: 'hour' },
                                    { label: '天', value: 'day' },
                                  ]}
                                />
                              </Form.Item>
                            </Form>
                          </div>

                          <Space
                            wrap
                            size={[10, 10]}
                            className="mailbox-toolbar-inline-actions mailbox-toolbar-inline-actions-responsive message-retention-toolbar-actions message-retention-toolbar-actions-responsive"
                          >
                            <Button
                              type="primary"
                              onClick={() => retentionForm.submit()}
                              className="domain-action-button domain-action-button-accent"
                              loading={mailboxBatchSubmitting}
                            >
                              保存设置
                            </Button>
                            <Button
                              className="domain-action-button"
                              loading={mailboxBatchSubmitting}
                              onClick={() => {
                                retentionForm.setFieldsValue({ retentionValue: null, retentionUnit: 'hour' });
                                retentionForm.submit();
                              }}
                            >
                              关闭清理
                            </Button>
                          </Space>
                        </div>
                      ) : (
                        <Empty description="请先创建邮箱后，再统一设置邮件自动清理" />
                      )}
                    </Card>

                    <Card
                      title="收件列表"
                      className="message-list-card message-list-card-responsive page-section-panel"
                      extra={
                        <Space size={[8, 8]} wrap>
                          {selectedMailbox ? <Tag color="blue">{selectedMailbox.address}</Tag> : null}
                          <Tag color={unreadCount ? 'error' : 'success'}>{unreadCount} 未读</Tag>
                        </Space>
                      }
                    >
                      {filteredMessages.length === 0 ? (
                        <Empty description={selectedMailbox ? '当前邮箱还没有收件记录' : '请先选择一个邮箱查看收件列表'} />
                      ) : (
                        <Space direction="vertical" size={10} style={{ width: '100%' }}>
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
                  </Space>
                )}
              </Space>
            )}

            {section === 'api' && (
              <Space
                direction="vertical"
                size={16}
                style={{ width: '100%' }}
                className="page-section page-section-api"
              >
                <SectionHero
                  title="API"
                  searchPlaceholder={SECTION_META.api.searchPlaceholder}
                  searchValue={sectionSearchText.api}
                  onSearchChange={(value) => updateSectionSearch('api', value)}
                  actions={(
                    <div className="domain-table-toolbar-actions mailbox-section-hero-actions mailbox-section-hero-actions-compact mailbox-section-hero-actions-responsive">
                      <Button
                        type="primary"
                        className="domain-action-button domain-action-button-accent domain-action-button-compact"
                        onClick={() => apiTokenForm.submit()}
                        loading={submitting}
                      >
                        创建 Token
                      </Button>
                    </div>
                  )}
                />

                {newApiToken?.token ? (
                  <Card className="api-token-highlight-card page-section-panel page-section-highlight-card" title="新 Token">
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
                        请立即复制保存，并用于下方示例命令。
                      </Text>
                    </Space>
                  </Card>
                ) : null}

                <Card className="api-overview-card api-overview-card-responsive page-section-panel page-section-panel-subtle">
                  <Row gutter={[16, 16]} align="top" className="api-panel-grid page-section-grid api-panel-grid-responsive">
                    <Col xs={24} xl={9}>
                      <Space direction="vertical" size={14} style={{ width: '100%' }} className="api-management-stack">
                        <Card title="Token" className="api-card api-card-compact page-section-panel page-section-panel-subtle api-subcard">
                          <Space direction="vertical" size={14} style={{ width: '100%' }}>
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
                              <Button
                                type="primary"
                                htmlType="submit"
                                loading={submitting}
                                block
                                className="domain-action-button domain-action-button-accent"
                              >
                                创建 Token
                              </Button>
                            </Form>
                          </Space>
                        </Card>

                        <Card title="调用方式" className="api-card api-card-compact page-section-panel api-subcard">
                          <Space direction="vertical" size={12} style={{ width: '100%' }}>
                            <div className="api-auth-panel api-auth-panel-compact">
                              <div className="api-auth-panel-head">
                                <Text strong>请求头</Text>
                                <Tag color="processing">Bearer</Tag>
                              </div>
                              <pre className="message-code-block api-code-block">Authorization: Bearer {'<token>'}</pre>
                            </div>

                            <div className="api-create-tips api-create-tips-compact">
                              <List
                                split={false}
                                dataSource={[
                                  '先创建 API Token。',
                                  'domain 直接填写已创建域名。',
                                  '邮箱地址和 messageId 来自对应查询接口。',
                                  '实际请求请在终端或客户端执行。',
                                ]}
                                renderItem={(item) => <List.Item className="guide-item">{item}</List.Item>}
                              />
                            </div>
                          </Space>
                        </Card>
                      </Space>
                    </Col>

                    <Col xs={24} xl={15}>
                      <Card title="接口清单" className="api-card api-card-compact page-section-panel api-endpoint-card">
                        <Space direction="vertical" size={14} style={{ width: '100%' }}>
                          <Segmented
                            block
                            value={apiEndpointKey}
                            onChange={setApiEndpointKey}
                            options={filteredApiEndpoints.map((item) => ({
                              label: item.title,
                              value: item.key,
                            }))}
                            className="api-endpoint-segmented"
                          />

                          <div className="api-endpoint-preview api-endpoint-preview-compact">
                            <Space direction="vertical" size={6} style={{ width: '100%' }}>
                              <Text strong>{activeApiEndpoint.title}</Text>
                              <pre className="message-code-block api-code-block">{activeApiEndpoint.endpoint}</pre>
                              <Text type="secondary">{activeApiEndpoint.summary}</Text>
                            </Space>
                          </div>

                          <div className="api-create-tips api-create-tips-compact api-usage-card">
                            <List
                              split={false}
                              dataSource={activeApiEndpoint.usage}
                              renderItem={(item) => <List.Item className="guide-item">{item}</List.Item>}
                            />
                          </div>

                          <div className="api-curl-block">
                            <Text strong className="api-curl-title">
                              curl 示例
                            </Text>
                            <pre className="message-code-block api-code-block">{activeApiEndpoint.example}</pre>
                          </div>
                        </Space>
                      </Card>
                    </Col>
                  </Row>
                </Card>

                <Card title="Token 列表" className="api-card api-card-compact api-token-table-card page-section-panel">
                  <Table
                    rowKey="id"
                    columns={apiTokenColumns}
                    dataSource={filteredApiTokens}
                    pagination={false}
                    scroll={{ x: 680 }}
                    className="api-token-table"
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
        onCancel={handleCloseMailboxModal}
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