import React from 'react';
import { Alert, Button, Card, Col, Popconfirm, Row, Space, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

function createDomainColumns({ formatDateTime, onOpenDetail, onDeleteDomain }) {
  return [
    {
      title: '域名',
      dataIndex: 'domain',
      key: 'domain',
      render: (value, record) => (
        <Space direction="vertical" size={4}>
          <Space wrap>
            <Text strong>{value}</Text>
            <Tag color={record.isActive ? 'success' : 'default'}>{record.isActive ? '可收件' : '待配置'}</Tag>
          </Space>
          <Text type="secondary">{record.note || '未填写用途说明'}</Text>
        </Space>
      ),
    },
    {
      title: 'DNS 指引',
      key: 'dns-guidance',
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Tag color="blue">DNS 配置</Tag>
          <Text type="secondary">
            {record.dnsRecords?.length ? `${record.dnsRecords.length} 条建议记录` : '创建后可查看建议记录'}
          </Text>
          <Text type="secondary">{record.isActive ? '建议继续核对记录完整性' : '建议先查看配置指引'}</Text>
        </Space>
      ),
    },
    {
      title: 'SMTP / 最近更新',
      key: 'smtp',
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text>{record.smtpHost ? `${record.smtpHost}:${record.smtpPort || 25}` : '默认监听 0.0.0.0:2525'}</Text>
          <Text type="secondary">最近更新：{formatDateTime(record.updatedAt || record.createdAt)}</Text>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => onOpenDetail(record.id)}>
            查看指引
          </Button>
          <Popconfirm title="确认删除该域名？" onConfirm={() => onDeleteDomain(record.id)}>
            <Button danger type="text" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
}

export default function DomainTableSection({
  domains,
  formatDateTime,
  onCreateDomain,
  onDeleteDomain,
  onOpenDetail,
}) {
  const columns = createDomainColumns({
    formatDateTime,
    onOpenDetail,
    onDeleteDomain,
  });

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="section-intro-card">
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col flex="auto">
            <Space direction="vertical" size={4}>
              <Title level={4} style={{ margin: 0 }}>
                域名管理
              </Title>
              <Text type="secondary">
                先添加域名，再进入详情查看通用 DNS 建议记录与后续配置步骤。
              </Text>
            </Space>
          </Col>
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={onCreateDomain}>
              添加域名
            </Button>
          </Col>
        </Row>
      </Card>

      <Card>
        <Alert
          type="info"
          showIcon
          className="table-top-alert"
          message="建议流程：添加域名 → 查看 DNS 指引 → 完成记录配置 → 创建邮箱"
          description="DNS 托管在 Cloudflare、阿里云、腾讯云或其他平台时，都应在各自的 DNS 面板完成邮件记录配置。"
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={domains}
          locale={{ emptyText: '暂无域名，请先添加一个收件域名开始配置流程。' }}
          pagination={false}
        />
      </Card>
    </Space>
  );
}