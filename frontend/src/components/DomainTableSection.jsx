import React from 'react';
import { Button, Card, Popconfirm, Row, Col, Space, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, EyeOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

function getDomainStatusMeta(record, dnsStatus) {
  if (dnsStatus?.status === 'ready') {
    return {
      label: '已可收件',
      color: 'success',
      summary: dnsStatus.summary || '最小收件记录已齐全，域名已可用于收件。',
      nextStep: dnsStatus.nextStep || '现在可以创建邮箱并发送测试邮件。',
      detail: '检测已确认最小记录可用。',
    };
  }

  if (record.isActive) {
    return {
      label: '已可收件',
      color: 'success',
      summary: 'DNS 已基本可用，下一步可以直接创建邮箱验证收件。',
      nextStep: '创建一个邮箱并投递测试邮件',
      detail: '当前域名已处于可收件状态。',
    };
  }

  return {
    label: '待完成配置',
    color: 'default',
    summary: dnsStatus?.summary || '域名已添加，但还需要先核对并补充最小 DNS 记录。',
    nextStep: dnsStatus?.nextStep || '先检测 DNS，再按建议补充记录',
    detail: `最少 ${record.dnsRecords?.length || 0} 条必需记录，建议先完成后再创建邮箱。`,
  };
}

function createDomainColumns({ domainDnsStatus, formatDateTime, onCreateMailbox, onDetectDns, onOpenDetail, onDeleteDomain }) {
  return [
    {
      title: '域名',
      dataIndex: 'domain',
      key: 'domain',
      width: 220,
      render: (value, record) => {
        const statusMeta = getDomainStatusMeta(record, domainDnsStatus[record.id]);

        return (
          <Space direction="vertical" size={8} className="domain-table-domain-cell">
            <Space wrap className="domain-table-domain-head">
              <Text strong className="domain-table-domain-name">
                {value}
              </Text>
              <Tag color={statusMeta.color} className="domain-table-status-tag">
                {statusMeta.label}
              </Tag>
            </Space>
            <Text type="secondary" className="domain-table-domain-note">
              {record.note || `最小记录 ${record.dnsRecords?.length || 0} 条`}
            </Text>
          </Space>
        );
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 260,
      render: (_, record) => {
        const statusMeta = getDomainStatusMeta(record, domainDnsStatus[record.id]);

        return (
          <div className="domain-table-cell-stack domain-table-status-cell">
            <Text strong className="domain-table-status-title">
              {statusMeta.label}
            </Text>
            <Text type="secondary" className="domain-table-status-next">
              {statusMeta.nextStep}
            </Text>
          </div>
        );
      },
    },
    {
      title: '更新时间',
      key: 'updatedAt',
      width: 180,
      render: (_, record) => (
        <Text type="secondary" className="domain-table-updated-at">
          {formatDateTime(record.updatedAt || record.createdAt)}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      render: (_, record) => (
        <div className="domain-action-group">
          <Button
            type="primary"
            ghost
            icon={<ThunderboltOutlined />}
            className="domain-action-button-primary"
            onClick={() => onDetectDns(record.id)}
          >
            检测 DNS
          </Button>
          <Button type="link" icon={<EyeOutlined />} className="domain-action-button-link" onClick={() => onOpenDetail(record.id)}>
            查看配置
          </Button>
          <Button type="link" className="domain-action-button-link" onClick={() => onCreateMailbox(record.id)}>
            创建邮箱
          </Button>
          <Popconfirm title="确认删除该域名？" onConfirm={() => onDeleteDomain(record.id)}>
            <Button danger type="text" icon={<DeleteOutlined />} className="domain-action-button-danger">
              删除
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ];
}

export default function DomainTableSection({
  domains,
  domainDnsStatus,
  formatDateTime,
  onCreateDomain,
  onCreateMailbox,
  onDeleteDomain,
  onDetectDns,
  onOpenDetail,
}) {
  const columns = createDomainColumns({
    domainDnsStatus,
    formatDateTime,
    onCreateMailbox,
    onDetectDns,
    onOpenDetail,
    onDeleteDomain,
  });
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }} className="domain-table-section">
      <Card className="section-intro-card">
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col flex="auto">
            <Space direction="vertical" size={4} className="domain-table-section-copy">
              <Title level={4} style={{ margin: 0 }}>
                域名管理
              </Title>
              <Text type="secondary">
                聚焦查看域名状态、下一步动作和常用操作。
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

      <Card className="domain-table-card">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={domains}
          locale={{ emptyText: '暂无域名，先添加一个域名。' }}
          pagination={false}
        />
      </Card>
    </Space>
  );
}