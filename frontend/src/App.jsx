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
  SettingOutlined,
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
          <Space size={[10, 10]} wrap className="brand-action-group">
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
    <Card className="page-toolbar-card page-toolbar-card-minimal">
      <div className="section-hero-toolbar">
        <div className="section-hero-search-slot">
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
        <div className="section-hero-actions-slot">
          {actions ? <div className="section-hero-actions">{actions}</div> : null}
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
        retentionValue: selectedMailboxRecord?.messageRetentionValue ?? null,
        retentionUnit: selectedMailboxRecord?.messageRetentionUnit ?? 'hour',
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
      retentionValue: selectedMailbox?.messageRetentionValue ?? null,
      retentionUnit: selectedMailbox?.messageRetentionUnit ?? 'hour',
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
    if (!selectedMailboxAddress) {
      message.warning('请先选择邮箱');
      return;
    }

    try {
      const payload = {
        retentionValue: values.retentionValue ? Number(values.retentionValue) : null,
        retentionUnit: values.retentionValue ? values.retentionUnit : null,
      };

      await updateMailboxMessageRetention(selectedMailboxAddress, payload);
      message.success(payload.retentionValue ? '邮件自动清理设置已更新' : '已关闭邮件自动清理');
      await loadData();
    } catch (error) {
      message.error(extractErrorMessage(error, '更新邮件自动清理设置失败'));
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
      title: '自动清理账号',
      key: 'retention',
      width: 140,
      render: (_, record) => (
        <Space direction="vertical" size={2} className="mailbox-table-cell-stack">
          <Text className="mailbox-table-primary-text">{getRetentionLabel(record)}</Text>
          <Text type="secondary" className="mailbox-table-secondary-text">
            {record.retentionValue ? '到时间后自动删除该邮箱账号' : '当前未启用'}
          </Text>
        </Space>
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
                    <Space wrap size={[10, 10]} className="mailbox-section-hero-actions mailbox-section-hero-actions-compact">
                      <Button
                        className="domain-action-button"
                        onClick={() => openMailboxModal({ random: true })}
                        disabled={!hasDomains}
                      >
                        随机邮箱
                      </Button>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        className="domain-action-button domain-action-button-accent"
                        onClick={() => openMailboxModal({ random: false })}
                        disabled={!hasDomains}
                      >
                        创建邮箱
                      </Button>
                    </Space>
                  )}
                />

                <Card className="mailbox-toolbar-card mailbox-toolbar-card-responsive" title="批量操作">
                  <div className="mailbox-toolbar-inline mailbox-toolbar-grid mailbox-toolbar-grid-responsive">
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
                          placeholder="时间"
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
                        保存邮箱清理
                      </Button>
                      <Button
                        className="domain-action-button"
                        onClick={() => handleBatchUpdateRetention(bulkRetentionForm.getFieldsValue(), { clear: true })}
                        disabled={retentionTargetMailboxes.length === 0}
                        loading={mailboxBatchSubmitting}
                      >
                        关闭邮箱清理
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

                <Card
                  className="mailbox-table-card mailbox-table-card-responsive"
                  title="邮箱列表"
                  extra={<Text type="secondary">{filteredMailboxes.length} 个结果</Text>}
                >
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
                      <Space wrap size={[10, 10]} className="mailbox-section-hero-actions mailbox-section-hero-actions-compact">
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
                      </Space>
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
                  <>
                    <Row gutter={[16, 16]} align="top" className="message-workspace-layout message-workspace-layout-responsive">
                      <Col xs={24} xl={15}>
                        <Card
                          title="收件列表"
                          className="message-list-card message-list-card-responsive"
                          extra={<Tag color={unreadCount ? 'error' : 'success'}>{unreadCount} 未读</Tag>}
                        >
                          {filteredMessages.length === 0 ? (
                            <Empty description={selectedMailbox ? '当前还没有收件记录' : '请先选择一个邮箱'} />
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
                      </Col>

                      <Col xs={24} xl={9}>
                        <Card title="当前邮箱" className="message-sidebar-card message-sidebar-card-responsive">
                          {selectedMailbox ? (
                            <Space
                              direction="vertical"
                              size={14}
                              style={{ width: '100%' }}
                              className="message-panel-stack message-panel-stack-responsive"
                            >
                              <div className="mailbox-setting-summary mailbox-setting-summary-compact">
                                <div className="mailbox-setting-summary-item">
                                  <Text type="secondary">邮箱地址</Text>
                                  <Text strong>{selectedMailbox.address}</Text>
                                </div>
                                <div className="mailbox-setting-summary-item">
                                  <Text type="secondary">所属域名</Text>
                                  <Text strong>{selectedMailbox.domain}</Text>
                                </div>
                                <div className="mailbox-setting-summary-item">
                                  <Text type="secondary">创建方式</Text>
                                  <Text strong>{selectedMailbox.source}</Text>
                                </div>
                                <div className="mailbox-setting-summary-item">
                                  <Text type="secondary">最近收件</Text>
                                  <Text strong>{formatDateTime(selectedMailbox.latestReceivedAt)}</Text>
                                </div>
                              </div>

                              <div className="message-summary-panel">
                                <Text strong className="message-summary-line">
                                  邮件自动清理
                                </Text>
                                <Text type="secondary">
                                  设置当前邮箱内邮件的保留时间。
                                </Text>
                              </div>

                              <Form
                                form={retentionForm}
                                layout="vertical"
                                onFinish={handleUpdateMessageRetention}
                                initialValues={{ retentionValue: null, retentionUnit: 'hour' }}
                                className="retention-form message-retention-form message-retention-form-responsive"
                              >
                                <div className="mailbox-setting-form-grid">
                                  <Form.Item name="retentionValue" label="邮件自动清理时间">
                                    <Input
                                      aria-label="邮件自动清理时间"
                                      type="number"
                                      min={1}
                                      placeholder="留空表示关闭"
                                    />
                                  </Form.Item>
                                  <Form.Item name="retentionUnit" label="单位">
                                    <Select
                                      aria-label="邮件自动清理时间单位"
                                      options={[
                                        { label: '小时', value: 'hour' },
                                        { label: '天', value: 'day' },
                                      ]}
                                    />
                                  </Form.Item>
                                </div>
                                <Space wrap size={[10, 10]} className="mailbox-setting-form-actions mailbox-setting-form-actions-responsive">
                                  <Button type="primary" icon={<SettingOutlined />} htmlType="submit">
                                    保存设置
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      retentionForm.setFieldsValue({ retentionValue: null, retentionUnit: 'hour' });
                                      retentionForm.submit();
                                    }}
                                  >
                                    关闭邮件自动清理
                                  </Button>
                                </Space>
                              </Form>
                            </Space>
                          ) : (
                            <Empty description="请先创建或选择邮箱" />
                          )}
                        </Card>
                      </Col>
                    </Row>
                  </>
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
                />

                {newApiToken?.token ? (
                  <Card className="api-token-highlight-card" title="新 Token">
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

                <Row gutter={[16, 16]} align="top">
                  <Col xs={24} xl={10}>
                    <Card title="Token" className="api-card">
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
                            使用说明
                          </Text>
                          <List
                            split={false}
                            dataSource={[
                              '先创建一个 API Token。',
                              'domain 直接填写已创建的域名，例如 example.com。',
                              '邮箱地址可通过“查询邮箱列表”接口获取，并在路径中做 URL 编码。',
                              'messageId 从邮件列表接口返回结果中获取。',
                              '页面仅提供说明和示例，实际调用请在终端或客户端中完成。',
                            ]}
                            renderItem={(item) => <List.Item className="guide-item">{item}</List.Item>}
                          />
                        </div>
                      </Space>
                    </Card>
                  </Col>

                  <Col xs={24} xl={14}>
                    <Card title="接口清单" className="api-card">
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
                            说明
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

                <Card title="Token 列表" className="api-card api-token-table-card">
                  <Table
                    rowKey="id"
                    columns={apiTokenColumns}
                    dataSource={filteredApiTokens}
                    pagination={false}
                    scroll={{ x: 680 }}
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