import { useEffect, useState } from 'react';
import {
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
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { Link } from 'react-router';
import { Permissions } from '@erp/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

interface AccountItem {
  id: string;
  email: string;
  fullName: string;
  employeeCode: string | null;
  phone: string | null;
  linkedEmployeeProfileId: string | null;
  isActive: boolean;
  roles: Array<{ id: string; code: string; name: string }>;
}

interface RoleOption {
  id: string;
  code: string;
  name: string;
}

export function AccountsPage() {
  const { hasPermission } = useAuth();
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountItem | null>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        api.get<{ items: AccountItem[] }>('/users'),
        api.get<RoleOption[]>('/roles'),
      ]);
      setAccounts(usersRes.data.items);
      setRoles(rolesRes.data);
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
      employeeCode: account.employeeCode,
      phone: account.phone,
      isActive: account.isActive,
      roleIds: account.roles.map((r) => r.id),
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      if (editingAccount) {
        await api.patch(`/users/${editingAccount.id}`, values);
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
    Modal.confirm({
      title: `Xóa tài khoản "${account.email}"?`,
      onOk: async () => {
        await api.delete(`/users/${account.id}`);
        message.success('Đã xóa tài khoản');
        loadData();
      },
    });
  };

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
          { title: 'Mã NV', dataIndex: 'employeeCode', render: (v) => v ?? '—' },
          { title: 'SĐT', dataIndex: 'phone', render: (v) => v ?? '—' },
          { title: 'Email', dataIndex: 'email' },
          {
            title: 'Hồ sơ liên kết',
            dataIndex: 'linkedEmployeeProfileId',
            render: (v: string | null) =>
              v ? <Tag color="green">Đã liên kết</Tag> : <Tag>Chưa có (HR)</Tag>,
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
                <Link to={`/setup/accounts/${record.id}`}>
                  <Button size="small">Xem chi tiết</Button>
                </Link>
                {hasPermission(Permissions.USER_UPDATE) && (
                  <Button size="small" onClick={() => openEdit(record)}>
                    Sửa
                  </Button>
                )}
                {hasPermission(Permissions.USER_DELETE) && (
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
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {!editingAccount && (
            <>
              <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, min: 8 }]}>
                <Input.Password />
              </Form.Item>
            </>
          )}
          <Form.Item name="fullName" label="Họ tên" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="employeeCode" label="Mã nhân viên">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại">
            <Input />
          </Form.Item>
          {editingAccount && (
            <>
              <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="isActive" label="Hoạt động" valuePropName="checked">
                <Switch />
              </Form.Item>
            </>
          )}
          <Form.Item name="roleIds" label="Vai trò" rules={[{ required: true }]}>
            <Select mode="multiple" options={roles.map((r) => ({ value: r.id, label: r.name }))} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
