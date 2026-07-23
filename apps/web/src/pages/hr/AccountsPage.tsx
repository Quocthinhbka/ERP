import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Permissions } from '@erp/shared';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/errors';
import { queryKeys } from '../../lib/queryKeys';
import { useAuth } from '../../contexts/AuthContext';
import { excelEnumColumnFilter } from '../../components/ExcelEnumColumnFilter';

interface LinkedEmployeeProfile {
  profileCode: string;
  fullName: string;
}

interface AccountItem {
  id: string;
  email: string | null;
  fullName: string;
  accountCode: string;
  phone: string | null;
  linkedEmployeeProfileId: string | null;
  positionCodes?: string[];
  linkedEmployeeProfile?: LinkedEmployeeProfile | null;
  isActive: boolean;
  mustChangePassword: boolean;
  isSuperAdmin?: boolean;
}

interface EmployeeProfileOption {
  id: string;
  profileCode: string;
  fullName: string;
  phone: string;
  email: string | null;
  status?: string;
}

function isSuperAdminAccount(account: AccountItem) {
  return account.isSuperAdmin === true;
}

function linkedProfileLabel(account: AccountItem) {
  const profile = account.linkedEmployeeProfile;
  if (!profile) return '—';
  return `${profile.fullName} - ${profile.profileCode}`;
}

const ACCOUNT_STATUS_FILTER_OPTIONS = [
  { value: 'true', label: 'Hoạt động' },
  { value: 'false', label: 'Khóa' },
];

async function fetchAccounts() {
  const { data } = await api.get<{ items: AccountItem[] }>('/users');
  return data.items;
}

async function fetchAvailableProfiles() {
  const { data } = await api.get<EmployeeProfileOption[]>(
    '/users/available-employee-profiles',
  );
  return data;
}

export function AccountsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string[]>([]);
  const [form] = Form.useForm();
  const canCreate = hasPermission(Permissions.USER_CREATE);

  const {
    data: accounts = [],
    isLoading: loading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: fetchAccounts,
  });

  const { data: employeeProfiles = [] } = useQuery({
    queryKey: queryKeys.availableEmployeeProfiles,
    queryFn: fetchAvailableProfiles,
    enabled: canCreate,
  });

  useEffect(() => {
    if (isError) {
      message.error(getApiErrorMessage(error, 'Không tải được danh sách tài khoản'));
    }
  }, [isError, error]);

  const createMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => api.post('/users', values),
    onSuccess: () => {
      message.success('Tạo tài khoản thành công');
      setModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      void queryClient.invalidateQueries({ queryKey: queryKeys.availableEmployeeProfiles });
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const openCreate = () => {
    form.resetFields();
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    await createMutation.mutateAsync(values);
  };

  const filteredAccounts = useMemo(() => {
    if (activeFilter.length === 0) return accounts;
    return accounts.filter((account) =>
      activeFilter.includes(String(account.isActive)),
    );
  }, [accounts, activeFilter]);

  return (
    <Card
      title="Quản lý tài khoản"
      data-testid="accounts-page"
      extra={
        canCreate && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            data-testid="account-create-btn"
            onClick={openCreate}
          >
            Thêm tài khoản
          </Button>
        )
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={filteredAccounts}
        columns={[
          { title: 'Mã tài khoản', dataIndex: 'accountCode', width: 130 },
          {
            title: 'Mã vị trí',
            dataIndex: 'positionCodes',
            width: 160,
            render: (codes: string[] | undefined) =>
              codes && codes.length > 0 ? codes.join(', ') : '—',
          },
          {
            title: 'Hồ sơ liên kết',
            width: 280,
            render: (_: unknown, record: AccountItem) => linkedProfileLabel(record),
          },
          {
            title: 'Ghi chú',
            width: 220,
            render: (_, record) => (
              <Space size={[4, 4]} wrap>
                {isSuperAdminAccount(record) && (
                  <Tag color="gold">Super Admin</Tag>
                )}
                {record.mustChangePassword && (
                  <Tag color="orange">Chờ đổi mật khẩu</Tag>
                )}
                {!isSuperAdminAccount(record) && !record.mustChangePassword && (
                  <Tag>Quyền theo vị trí tổ chức</Tag>
                )}
              </Space>
            ),
          },
          {
            title: 'Trạng thái',
            dataIndex: 'isActive',
            width: 120,
            ...excelEnumColumnFilter<AccountItem>({
              options: ACCOUNT_STATUS_FILTER_OPTIONS,
              filteredValue: activeFilter,
              onApply: setActiveFilter,
            }),
            render: (v: boolean) =>
              v ? <Tag color="green">Hoạt động</Tag> : <Tag color="red">Khóa</Tag>,
          },
          {
            title: 'Chi tiết',
            width: 80,
            render: (_, record) => (
              <Tooltip title="Xem chi tiết">
                <Link to={`/hr/accounts/${record.id}`}>
                  <Button size="small" type="text" icon={<EyeOutlined />} />
                </Link>
              </Tooltip>
            ),
          },
        ]}
      />

      <Modal
        title="Thêm tài khoản"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="employeeProfileId"
            label="Hồ sơ nhân viên"
            rules={[{ required: true, message: 'Chọn hồ sơ để tạo tài khoản' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn hồ sơ chưa liên kết"
              options={employeeProfiles.map((profile) => ({
                value: profile.id,
                label: `${profile.profileCode} — ${profile.fullName} (${profile.phone}${
                  profile.email ? ` · ${profile.email}` : ''
                })`,
              }))}
              optionRender={(option) => {
                const profile = employeeProfiles.find((p) => p.id === option.value);
                if (!profile) return option.label;
                return (
                  <Space direction="vertical" size={0}>
                    <Typography.Text>
                      {profile.profileCode} — {profile.fullName}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      {profile.phone}
                      {profile.email ? ` · ${profile.email}` : ''}
                      {profile.status ? ` · ${profile.status}` : ''}
                    </Typography.Text>
                  </Space>
                );
              }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
