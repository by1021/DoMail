import React from 'react';
import { Button, Card, Col, Popconfirm, Row, Space, Table, Tag, Typography } from 'antd';
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
          <Text strong>{value}</Text>
          <Text type="secondary">{record.note || '未填写用途说明'}</Text>
        </Space>
      ),
    },
    {
      title: '运行状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 120,
      render: (value) => <Tag color={value ? 'green' : 'default'}>{value ? 'active' : 'inactive'}</Tag>,
    },
    {
      title: 'Cloudflare 记录',
      key: 'cloudflare',
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Tag color="blue">Cloudflare DNS</Tag>
          <Text type="secondary">
            {record.dnsRecords?.length ? `${record.dnsRecords.length} 条建议记录` : '可查看建议记录清单'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'SMTP / 更新时间',
      key: 'smtp',
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text>{record.smtpHost ? `${record.smtpHost}:${record.smtpPort || 25}` : '默认监听 0.0.0.0:2525'}</Text>
          <Text type="secondary">更新时间：{formatDateTime(record.updatedAt || record.createdAt)}</Text>
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
            查看设置
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
                管理 SMTP 收件域名，并查看当域名 DNS 托管在 Cloudflare 时还需补充哪些邮件记录。
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
        <Table
          rowKey="id"
          columns={columns}
          dataSource={domains}
          locale={{ emptyText: '暂无域名，可先创建一个收件域名。' }}
          pagination={false}
        />
      </Card>
    </Space>
  );
}