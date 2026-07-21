import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Divider,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { Permissions } from '@erp/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: Array<{ id: string; code: string; name: string }>;
}

interface PermissionItem {
  id: string;
  code: string;
  name: string;
  module: string;
}

const MODULE_LABELS: Record<string, string> = {
  setup: 'Thiết lập',
  user: 'Người dùng',
  role: 'Phân quyền',
};

function groupPermissionsByModule(items: PermissionItem[]) {
  return items.reduce<Record<string, PermissionItem[]>>((acc, item) => {
    if (!acc[item.module]) {
      acc[item.module] = [];
    }
    acc[item.module].push(item);
    return acc;
  }, {});
}

export function RolesPage() {
  const { hasPermission } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form] = Form.useForm();
  const permissionsByModule = groupPermissionsByModule(permissions);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        api.get<Role[]>('/roles'),
        api.get<{ items: PermissionItem[] }>('/permissions'),
      ]);
      setRoles(rolesRes.data);
      setPermissions(permsRes.data.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditingRole(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (role: Role) => {
    setEditingRole(role);
    form.setFieldsValue({
      code: role.code,
      name: role.name,
      description: role.description,
      permissionIds: role.permissions.map((p) => p.id),
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: {
    code: string;
    name: string;
    description?: string;
    permissionIds: string[];
  }) => {
    if (editingRole?.isSystem) {
      setModalOpen(false);
      return;
    }
    try {
      if (editingRole) {
        await api.patch(`/roles/${editingRole.id}`, {
          name: values.name,
          description: values.description,
          permissionIds: values.permissionIds,
        });
        message.success('Cập nhật vai trò thành công');
      } else {
        await api.post('/roles', values);
        message.success('Tạo vai trò thành công');
      }
      setModalOpen(false);
      loadData();
    } catch {
      message.error('Thao tác thất bại');
    }
  };

  const handleDelete = async (role: Role) => {
    Modal.confirm({
      title: `Xóa vai trò "${role.name}"?`,
      onOk: async () => {
        await api.delete(`/roles/${role.id}`);
        message.success('Đã xóa vai trò');
        loadData();
      },
    });
  };

  return (
    <Card
      title="Quản lý vai trò"
      extra={
        hasPermission(Permissions.ROLE_CREATE) && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm vai trò
          </Button>
        )
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={roles}
        columns={[
          { title: 'Mã', dataIndex: 'code' },
          { title: 'Tên', dataIndex: 'name' },
          { title: 'Mô tả', dataIndex: 'description' },
          {
            title: 'Loại',
            dataIndex: 'isSystem',
            render: (v: boolean) => (v ? <Tag color="blue">Hệ thống</Tag> : <Tag>Tùy chỉnh</Tag>),
          },
          { title: 'Số người dùng', dataIndex: 'userCount' },
          {
            title: 'Quyền',
            dataIndex: 'permissions',
            render: (perms: Role['permissions']) => (
              <Typography.Text ellipsis>{perms.map((p) => p.name).join(', ')}</Typography.Text>
            ),
          },
          {
            title: 'Thao tác',
            render: (_, record) => (
              <Space>
                {hasPermission(Permissions.ROLE_UPDATE) && !record.isSystem && (
                  <Button size="small" onClick={() => openEdit(record)}>
                    Sửa
                  </Button>
                )}
                {record.isSystem && (
                  <Button size="small" onClick={() => openEdit(record)}>
                    Xem
                  </Button>
                )}
                {hasPermission(Permissions.ROLE_DELETE) && !record.isSystem && (
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
        title={
          editingRole?.isSystem
            ? `Xem vai trò${editingRole.code === 'super_admin' ? ' (Super Admin — không thể sửa)' : ' hệ thống'}`
            : editingRole
              ? 'Sửa vai trò'
              : 'Thêm vai trò'
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => (editingRole?.isSystem ? setModalOpen(false) : form.submit())}
        okText={editingRole?.isSystem ? 'Đóng' : 'OK'}
        cancelButtonProps={editingRole?.isSystem ? { style: { display: 'none' } } : undefined}
        destroyOnHidden
      >
        {editingRole?.code === 'super_admin' && (
          <Typography.Paragraph type="secondary">
            Super Admin mặc định toàn quyền hệ thống và không thể thay đổi.
          </Typography.Paragraph>
        )}
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {!editingRole && (
            <Form.Item name="code" label="Mã vai trò" rules={[{ required: true }]}>
              <Input placeholder="sales_manager" />
            </Form.Item>
          )}
          <Form.Item name="name" label="Tên vai trò" rules={[{ required: true }]}>
            <Input disabled={!!editingRole?.isSystem} />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} disabled={!!editingRole?.isSystem} />
          </Form.Item>
          <Form.Item
            name="permissionIds"
            label="Quyền hạn"
            rules={
              editingRole?.isSystem
                ? []
                : [
                    {
                      required: true,
                      type: 'array',
                      min: 1,
                      message: 'Chọn ít nhất một quyền',
                    },
                  ]
            }
          >
            <Checkbox.Group
              disabled={!!editingRole?.isSystem}
              data-testid="role-permissions"
              style={{ width: '100%' }}
            >
              {Object.entries(permissionsByModule).map(([module, items], index, arr) => (
                <div key={module}>
                  <Typography.Text strong>
                    {MODULE_LABELS[module] ?? module}
                  </Typography.Text>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      marginTop: 8,
                      marginBottom: 12,
                    }}
                  >
                    {items.map((p) => (
                      <Checkbox key={p.id} value={p.id} data-testid={`permission-${p.code}`}>
                        {p.name}{' '}
                        <Typography.Text type="secondary">({p.code})</Typography.Text>
                      </Checkbox>
                    ))}
                  </div>
                  {index < arr.length - 1 && <Divider style={{ margin: '0 0 12px' }} />}
                </div>
              ))}
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
