import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Link } from 'react-router';
import { EntityStatus, Permissions } from '@erp/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import type { EmployeeListItem, EmployeeListPage, EmployeeStatus } from './employee-types';

export function EmployeesPage() {
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<EmployeeListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<EmployeeStatus | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<EmployeeListPage>('/employees', {
        params: {
          page,
          pageSize,
          search: search.trim() || undefined,
          status,
        },
      });
      setItems(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, status]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const lockProfile = (profile: EmployeeListItem) => {
    Modal.confirm({
      title: `Khóa hồ sơ ${profile.profileCode}?`,
      content: 'Hồ sơ sẽ chuyển sang trạng thái đã khóa và không dùng cho nghiệp vụ mới.',
      okButtonProps: { danger: true },
      onOk: async () => {
        await api.delete(`/employees/${profile.id}`);
        message.success('Đã khóa hồ sơ nhân viên');
        await loadData();
      },
    });
  };

  return (
    <Card
      title="Sơ yếu lý lịch"
      extra={hasPermission(Permissions.HR_EMPLOYEE_CREATE) ? <Link to="/hr/employees/new"><Button type="primary" icon={<PlusOutlined />}>Khai báo sơ yếu lý lịch</Button></Link> : null}
    >
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Tìm theo mã, họ tên, SĐT, email hoặc CCCD"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          style={{ width: 360 }}
        />
        <Select
          allowClear
          placeholder="Trạng thái"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          style={{ width: 180 }}
          options={[
            { value: EntityStatus.ACTIVE, label: 'Đang hoạt động' },
            { value: EntityStatus.INACTIVE, label: 'Đã khóa' },
          ]}
        />
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        scroll={{ x: 980 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (value) => `Tổng ${value} hồ sơ`,
          onChange: (nextPage, nextSize) => {
            setPage(nextPage);
            setPageSize(nextSize);
          },
        }}
        columns={[
          { title: 'Mã hồ sơ', dataIndex: 'profileCode', width: 130 },
          { title: 'Họ và tên', dataIndex: 'fullName', width: 220 },
          { title: 'SĐT', dataIndex: 'phone', width: 140 },
          { title: 'Email', dataIndex: 'email', width: 220 },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            width: 150,
            render: (value: EmployeeStatus) =>
              value === EntityStatus.ACTIVE ? (
                <Tag color="green">Đang hoạt động</Tag>
              ) : (
                <Tag color="red">Đã khóa</Tag>
              ),
          },
          {
            title: 'Chi tiết',
            width: 280,
            render: (_, record) => (
              <Space>
                <Link to={`/hr/employees/${record.id}`}><Button size="small">Xem</Button></Link>
                {hasPermission(Permissions.HR_EMPLOYEE_UPDATE) ? (
                  <Link to={`/hr/employees/${record.id}/edit`}><Button size="small">Sửa</Button></Link>
                ) : null}
                {record.status === EntityStatus.ACTIVE && hasPermission(Permissions.HR_EMPLOYEE_DELETE) ? (
                  <Button size="small" danger onClick={() => lockProfile(record)}>Khóa</Button>
                ) : null}
              </Space>
            ),
          },
        ]}
      />
    </Card>
  );
}
