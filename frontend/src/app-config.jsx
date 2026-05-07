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
    summary: '获取邮箱列表',
    usage: [
      '无需参数，仅需 Bearer Token 认证',
      '返回 items 数组，包含所有邮箱信息',
      '从结果中提取 address 字段用于后续查询邮件',
    ],
    example: `# 基础调用
curl ${API_EXAMPLE_BASE_URL}/mailboxes \\
  -H "Authorization: Bearer <token>"

# 返回示例
{
  "ok": true,
  "items": [
    {
      "id": "mbx_xxx",
      "address": "test@example.com",
      "domain": "example.com",
      "messageCount": 5,
      "latestReceivedAt": "2024-01-15T10:30:00Z"
    }
  ]
}`,
  },
  {
    key: 'create-mailbox',
    title: '创建邮箱',
    endpoint: 'POST /api/mailboxes',
    summary: '创建邮箱',
    usage: [
      'domain：已创建的主域名（必填）',
      'localPart：自定义前缀（与 random 二选一）',
      'random：true 随机前缀，false 使用 localPart',
      'subdomain：自定义子域名（优先级高于 randomSubdomain）',
      'randomSubdomain：true 随机子域名，false 使用主域名',
    ],
    example: `# 自定义前缀 + 主域名：test@example.com
curl -X POST ${API_EXAMPLE_BASE_URL}/mailboxes \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <token>" \\
  -d '{"domain":"example.com","localPart":"test","random":false}'

# 随机前缀 + 主域名：m1a2b@example.com
curl -X POST ${API_EXAMPLE_BASE_URL}/mailboxes \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <token>" \\
  -d '{"domain":"example.com","random":true}'

# 自定义前缀 + 随机子域名：ops@x8k2m.example.com
curl -X POST ${API_EXAMPLE_BASE_URL}/mailboxes \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <token>" \\
  -d '{"domain":"example.com","localPart":"ops","randomSubdomain":true}'

# 随机前缀 + 自定义子域名：m3c4d@mail.example.com
curl -X POST ${API_EXAMPLE_BASE_URL}/mailboxes \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <token>" \\
  -d '{"domain":"example.com","random":true,"subdomain":"mail"}'`,
  },
  {
    key: 'delete-mailbox',
    title: '删除邮箱',
    endpoint: 'DELETE /api/mailboxes/:address',
    summary: '删除邮箱',
    usage: [
      ':address 路径参数：完整邮箱地址（必须 URL 编码）',
      '删除后该邮箱立即停止接收邮件',
      '已收到的邮件也会一并删除',
    ],
    example: `# 删除 test@example.com
# 注意：@ 需编码为 %40
curl -X DELETE ${API_EXAMPLE_BASE_URL}/mailboxes/test%40example.com \\
  -H "Authorization: Bearer <token>"

# 删除子域名邮箱 ops@mail.example.com
curl -X DELETE ${API_EXAMPLE_BASE_URL}/mailboxes/ops%40mail.example.com \\
  -H "Authorization: Bearer <token>"`,
  },
  {
    key: 'messages',
    title: '邮件列表',
    endpoint: 'GET /api/mailboxes/:address/messages',
    summary: '获取邮件列表',
    usage: [
      ':address 路径参数：完整邮箱地址（必须 URL 编码）',
      '返回该邮箱的所有邮件，按时间倒序',
      '从结果中提取 id 字段作为 messageId 查看详情',
    ],
    example: `# 查询 test@example.com 的邮件列表
curl ${API_EXAMPLE_BASE_URL}/mailboxes/test%40example.com/messages \\
  -H "Authorization: Bearer <token>"

# 返回示例
{
  "ok": true,
  "items": [
    {
      "id": "msg_xxx",
      "subject": "欢迎使用",
      "fromAddress": "noreply@service.com",
      "receivedAt": "2024-01-15T10:30:00Z",
      "isRead": false
    }
  ]
}`,
  },
  {
    key: 'latest',
    title: '最新邮件',
    endpoint: 'GET /api/mailboxes/:address/messages?latest=1',
    summary: '获取最新一封邮件',
    usage: [
      ':address 路径参数：完整邮箱地址（必须 URL 编码）',
      'latest=1 查询参数：仅返回最新一封',
      '适合轮询场景，减少数据传输',
    ],
    example: `# 获取 test@example.com 的最新邮件
curl ${API_EXAMPLE_BASE_URL}/mailboxes/test%40example.com/messages?latest=1 \\
  -H "Authorization: Bearer <token>"

# 轮询检查新邮件（每 5 秒）
while true; do
  curl -s ${API_EXAMPLE_BASE_URL}/mailboxes/test%40example.com/messages?latest=1 \\
    -H "Authorization: Bearer <token>" | jq '.items[0].subject'
  sleep 5
done`,
  },
  {
    key: 'detail',
    title: '邮件详情',
    endpoint: 'GET /api/messages/:messageId',
    summary: '获取邮件详情',
    usage: [
      ':messageId 路径参数：来自邮件列表的 id 字段',
      '返回完整邮件：正文、头信息、附件元数据',
      '支持 HTML 和纯文本正文格式',
    ],
    example: `# 获取邮件详情
curl ${API_EXAMPLE_BASE_URL}/messages/msg_abc123xyz \\
  -H "Authorization: Bearer <token>"

# 返回示例
{
  "ok": true,
  "item": {
    "id": "msg_abc123xyz",
    "subject": "欢迎使用",
    "fromAddress": "noreply@service.com",
    "toAddress": "test@example.com",
    "htmlBody": "<p>欢迎！</p>",
    "textBody": "欢迎！",
    "headers": {...},
    "attachments": []
  }
}`,
  },
  {
    key: 'latest-detail',
    title: '最新邮件详情',
    endpoint: 'GET /api/mailboxes/:address/latest-message',
    summary: '获取最新邮件完整详情',
    usage: [
      ':address 路径参数：完整邮箱地址（必须 URL 编码）',
      '直接返回最新一封邮件的完整详情，无需先查邮件列表',
      '返回格式与邮件详情接口一致，包含 attachments 附件数组',
    ],
    example: `# 获取 test@example.com 的最新邮件完整详情
curl ${API_EXAMPLE_BASE_URL}/mailboxes/test%40example.com/latest-message \\
  -H "Authorization: Bearer <token>"`,
  },
];