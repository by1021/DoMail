import React from 'react';
import { Button, Card, Input, Popconfirm, Space, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, EyeOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { getDomainStatusMeta } from '../app-view-helpers.js';

const { Text } = Typography;

function createDomainColumns({ domainDnsStatus, formatDateTime, onOpenDetail, onDeleteDomain }) {
  return [
    {
      title: '域名',
      dataIndex: 'domain',
      key: 'domain',
      width: 220,
      render: (value, record) => {
        const statusMeta = getDomainStatusMeta(record, domainDnsStatus[record.id]);

        return (
          <div className="domain-table-cell-stack domain-table-domain-cell">
            <Space wrap size={[8, 8]} className="domain-table-domain-head">
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
          </div>
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
              {statusMeta.summary}
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
      width: 160,
      render: (_, record) => (
        <div className="domain-table-cell-stack domain-table-updated-cell">
          <Text className="domain-table-updated-at">
            {formatDateTime(record.updatedAt || record.createdAt)}
          </Text>
          <Text type="secondary" className="domain-table-updated-meta">
            {record.updatedAt ? '最近更新' : '创建时间'}
          </Text>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <div className="domain-action-group domain-action-group-inline domain-action-group-compact">
          <Button
            type="default"
            icon={<EyeOutlined />}
            className="domain-action-button domain-action-button-accent domain-action-button-compact"
            onClick={() => onOpenDetail(record.id)}
          >
            查看详情
          </Button>
          <Popconfirm title="确认删除该域名？" onConfirm={() => onDeleteDomain(record.id)}>
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
}

export default function DomainTableSection({
  domains,
  domainDnsStatus,
  formatDateTime,
  searchText,
  onSearchChange,
  onCreateDomain,
  onDeleteDomain,
  onOpenDetail,
}) {
  const columns = createDomainColumns({
    domainDnsStatus,
    formatDateTime,
    onOpenDetail,
    onDeleteDomain,
  });
  return (
    <Space
      direction="vertical"
      size={16}
      style={{ width: '100%' }}
      className="page-section domain-table-section domain-table-section-responsive"
    >
      <Card className="page-toolbar-card page-toolbar-card-minimal domain-toolbar-card-responsive">
        <div className="domain-table-toolbar domain-table-toolbar-minimal domain-table-toolbar-responsive">
          <div className="section-hero-search-slot">
            <Input
              aria-label="域名搜索"
              placeholder="搜索域名或备注"
              prefix={<SearchOutlined />}
              allowClear
              value={searchText}
              onChange={(event) => onSearchChange(event.target.value)}
              className="domain-table-search"
            />
          </div>
          <div className="section-hero-actions-slot">
            <div className="domain-table-toolbar-actions domain-table-toolbar-actions-responsive">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={onCreateDomain}
                className="domain-action-button domain-action-button-accent domain-action-button-compact"
              >
                新建域名
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="domain-table-card domain-table-card-responsive">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={domains}
          locale={{ emptyText: '暂无域名，先添加一个域名。' }}
          pagination={false}
          scroll={{ x: 620 }}
        />
      </Card>
    </Space>
  );
}