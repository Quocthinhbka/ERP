import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { Link } from 'react-router';
import { Permissions, SystemRole } from '@erp/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

interface AccountItem {
  id: string;
  email: string | null;
  fullName: string;
  accountCode: string;
  phone: string | null;
  linkedEmployeeProfileId: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  isSuperAdmin?: boolean;
  roles: Array<{ id: string; code: string; name: string }>;
}

interface RoleOption {
  id: string;
  code: string;
  name: string;
}

interface EmployeeProfileOption {
  id: string;
  profileCode: string;
  fullName: string;
  phone: string;
  email: string;
}

function isSuperAdminAccount(account: AccountItem) {
  return (
    account.isSuperAdmin === true ||
    account.roles.some((r) => r.code === SystemRole.SUPER_ADMIN)
  );
}

export function AccountsPage() {
  const { hasPermission } = useAuth();
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [employeeProfiles, setEmployeeProfiles] = useState<
    EmployeeProfileOption[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountItem | null>(null);
  const [form] = Form.useForm();

  const assignableRoles = useMemo(
    () => roles.filter((r) => r.code !== SystemRole.SUPER_ADMIN),
    [roles],
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes, profilesRes] = await Promise.all([
        api.get<{ items: AccountItem[] }>('/users'),
        api.get<RoleOption[]>('/roles'),
        hasPermission(Permissions.USER_CREATE)
          ? api.get<EmployeeProfileOption[]>(
              '/users/available-employee-profiles',
            )
          : Promise.resolve({ data: [] as EmployeeProfileOption[] }),
      ]);
      setAccounts(usersRes.data.items);
      setRoles(rolesRes.data);
      setEmployeeProfiles(profilesRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditingAccount(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (account: AccountItem) => {
    setEditingAccount(account);
    form.setFieldsValue({
      fullName: account.fullName,
      email: account.email,
      phone: account.phone,
      isActive: account.isActive,
      roleIds: account.roles.map((r) => r.id),
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      if (editingAccount) {
        const payload = { ...values };
        if (editingAccount.linkedEmployeeProfileId) {
          delete payload.fullName;
          delete payload.phone;
          delete payload.email;
        }
        if (isSuperAdminAccount(editingAccount)) {
          delete payload.roleIds;
          delete payload.isActive;
        }
        await api.patch(`/users/${editingAccount.id}`, payload);
        message.success('Cập nhật tài khoản thành công');
      } else {
        await api.post('/users', values);
        message.success('Tạo tài khoản thành công');
      }
      setModalOpen(false);
      loadData();
    } catch {
      message.error('Thao tác thất bại');
    }
  };

  const handleDelete = (account: AccountItem) => {
    if (isSuperAdminAccount(account)) {
      message.warning('Không thể xóa tài khoản Super Admin');
      return;
    }
    Modal.confirm({
      title: `Xóa tài khoản "${account.accountCode}"?`,
      onOk: async () => {
        await api.delete(`/users/${account.id}`);
        message.success('Đã xóa tài khoản');
        loadData();
      },
    });
  };

  const editingSuperAdmin = editingAccount ? isSuperAdminAccount(editingAccount) : false;

  return (
    <Card
      title="Quản lý tài khoản"
      extra={
        hasPermission(Permissions.USER_CREATE) && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm tài khoản
          </Button>
        )
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={accounts}
        columns={[
          { title: 'Mã tài khoản', dataIndex: 'accountCode' },
          { title: 'Họ và tên', dataIndex: 'fullName' },
          { title: 'SĐT', dataIndex: 'phone', render: (v) => v ?? '—' },
          { title: 'Email', dataIndex: 'email', render: (v) => v ?? '—' },
          {
            title: 'Hồ sơ liên kết',
            dataIndex: 'linkedEmployeeProfileId',
            render: (v: string | null) =>
              v ? <Tag color="green">Đã liên kết</Tag> : <Tag>Chưa có (HR)</Tag>,
          },
          {
            title: 'Vai trò',
            dataIndex: 'roles',
            render: (roles: AccountItem['roles'], record) => (
              <Space size={[4, 4]} wrap>
                {roles.map((r) => (
                  <Tag key={r.id} color={r.code === SystemRole.SUPER_ADMIN ? 'blue' : undefined}>
                    {r.name}
                  </Tag>
                ))}
                {isSuperAdminAccount(record) && <Tag color="gold">Full quyền</Tag>}
                {record.mustChangePassword && (
                  <Tag color="orange">Chờ đổi mật khẩu</Tag>
                )}
              </Space>
            ),
          },
          {
            title: 'Trạng thái',
            dataIndex: 'isActive',
            render: (v: boolean) =>
              v ? <Tag color="green">Hoạt động</Tag> : <Tag color="red">Khóa</Tag>,
          },
          {
            title: 'Thao tác',
            render: (_, record) => (
              <Space>
                <Link to={`/hr/accounts/${record.id}`}>
                  <Button size="small">Xem chi tiết</Button>
                </Link>
                {hasPermission(Permissions.USER_UPDATE) && (
                  <Button size="small" onClick={() => openEdit(record)}>
                    Sửa
                  </Button>
                )}
                {hasPermission(Permissions.USER_DELETE) && !isSuperAdminAccount(record) && (
                  <Button size="small" danger onClick={() => handleDelete(record)}>
                    Xóa
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editingAccount ? 'Sửa tài khoản' : 'Thêm tài khoản'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        destroyOnHidden
        width={520}
      >
        {editingSuperAdmin && (
          <Typography.Paragraph type="secondary">
            Super Admin có toàn quyền hệ thống. Không thể đổi vai trò, khóa hoặc xóa tài khoản này.
          </Typography.Paragraph>
        )}
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {!editingAccount && (
            <>
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message="Mã tài khoản lấy theo mã hồ sơ. Mật khẩu mặc định là 8 số cuối SĐT và người dùng phải đổi ngay lần đăng nhập đầu."
              />
              <Form.Item
                name="employeeProfileId"
                label="Hồ sơ nhân viên"
                rules={[
                  { required: true, message: 'Chọn hồ sơ nhân viên' },
                ]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn hồ sơ chưa có tài khoản"
                  options={employeeProfiles.map((profile) => ({
                    value: profile.id,
                    label: `${profile.profileCode} — ${profile.fullName} — ${profile.phone} — ${profile.email}`,
                  }))}
                />
              </Form.Item>
            </>
          )}
          {editingAccount && (
            <Form.Item name="fullName" label="Họ tên" rules={[{ required: true }]}>
              <Input disabled={Boolean(editingAccount.linkedEmployeeProfileId)} />
            </Form.Item>
          )}
          {editingAccount && (
            <Form.Item label="Mã tài khoản">
              <Input value={editingAccount.accountCode} disabled />
            </Form.Item>
          )}
          {editingAccount && (
            <Form.Item name="phone" label="Số điện thoại">
              <Input disabled={Boolean(editingAccount.linkedEmployeeProfileId)} />
            </Form.Item>
          )}
          {editingAccount && (
            <>
              <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}>
                <Input disabled={Boolean(editingAccount.linkedEmployeeProfileId)} />
              </Form.Item>
              <Form.Item name="isActive" label="Hoạt động" valuePropName="checked">
                <Switch disabled={editingSuperAdmin} />
              </Form.Item>
            </>
          )}
          <Form.Item name="roleIds" label="Vai trò" rules={[{ required: true }]}>
            <Select
              mode="multiple"
              disabled={editingSuperAdmin}
              options={(editingSuperAdmin ? roles : assignableRoles).map((r) => ({
                value: r.id,
                label: r.name,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
