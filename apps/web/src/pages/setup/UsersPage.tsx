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
import { Permissions } from '@erp/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

interface UserItem {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: Array<{ id: string; code: string; name: string }>;
}

interface RoleOption {
  id: string;
  code: string;
  name: string;
}

export function UsersPage() {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        api.get<{ items: UserItem[] }>('/users'),
        api.get<RoleOption[]>('/roles'),
      ]);
      setUsers(usersRes.data.items);
      setRoles(rolesRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditingUser(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (user: UserItem) => {
    setEditingUser(user);
    form.setFieldsValue({
      fullName: user.fullName,
      isActive: user.isActive,
      roleIds: user.roles.map((r) => r.id),
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: {
    email?: string;
    password?: string;
    fullName: string;
    isActive?: boolean;
    roleIds: string[];
  }) => {
    try {
      if (editingUser) {
        await api.patch(`/users/${editingUser.id}`, values);
        message.success('Cập nhật người dùng thành công');
      } else {
        await api.post('/users', values);
        message.success('Tạo người dùng thành công');
      }
      setModalOpen(false);
      loadData();
    } catch {
      message.error('Thao tác thất bại');
    }
  };

  const handleDelete = async (user: UserItem) => {
    Modal.confirm({
      title: `Xóa người dùng "${user.email}"?`,
      onOk: async () => {
        await api.delete(`/users/${user.id}`);
        message.success('Đã xóa người dùng');
        loadData();
      },
    });
  };

  return (
    <Card
      title="Quản lý người dùng"
      extra={
        hasPermission(Permissions.USER_CREATE) && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm người dùng
          </Button>
        )
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={users}
        columns={[
          { title: 'Email', dataIndex: 'email' },
          { title: 'Họ tên', dataIndex: 'fullName' },
          {
            title: 'Trạng thái',
            dataIndex: 'isActive',
            render: (v: boolean) => (v ? <Tag color="green">Hoạt động</Tag> : <Tag color="red">Khóa</Tag>),
          },
          {
            title: 'Vai trò',
            dataIndex: 'roles',
            render: (r: UserItem['roles']) => r.map((role) => <Tag key={role.id}>{role.name}</Tag>),
          },
          {
            title: 'Thao tác',
            render: (_, record) => (
              <Space>
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
        title={editingUser ? 'Sửa người dùng' : 'Thêm người dùng'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {!editingUser && (
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
          {editingUser && (
            <Form.Item name="isActive" label="Hoạt động" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
          <Form.Item name="roleIds" label="Vai trò" rules={[{ required: true }]}>
            <Select
              mode="multiple"
              options={roles.map((r) => ({ value: r.id, label: r.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
