import React from 'react';
import {
  ApiOutlined,
  GlobalOutlined,
  InboxOutlined,
  MailOutlined,
} from '@ant-design/icons';

export const SECTION_DEFINITIONS = [
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

export const SECTION_META = {
  domains: {
    searchPlaceholder: '搜索域名或备注',
  },
  mailboxes: {
    searchPlaceholder: '搜索邮箱地址或域名',
  },
  messages: {
    searchPlaceholder: '搜索主题、发件人、收件地址',
  },
  api: {
    searchPlaceholder: '搜索 Token 或接口说明',
  },
};

function getApiExampleBaseUrl() {
  const origin = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://mail.example.com';

  return `${origin}/api`;
}

export function buildSectionOptions(activeSection) {
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

const API_EXAMPLE_BASE_URL = getApiExampleBaseUrl();

export const API_ENDPOINTS = [
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
    summary: '创建邮箱，支持自定义/随机前缀与主域名/子域名模式。',
    usage: [
      '请求头携带 Authorization: Bearer <token>。',
      'domain 填已创建主域名；localPart 用于自定义前缀，random=true 为随机前缀。',
      'randomSubdomain=true 为随机子域名；subdomain 用于自定义子域名，且优先生效。',
    ],
    example: `curl -X POST ${API_EXAMPLE_BASE_URL}/mailboxes \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <token>" \\
  -d '{"domain":"example.com","localPart":"test","random":false,"randomSubdomain":false}'`,
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