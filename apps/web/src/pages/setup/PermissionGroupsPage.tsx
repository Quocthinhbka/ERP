import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Collapse,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Permissions } from '@erp/shared';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/errors';
import { queryKeys } from '../../lib/queryKeys';
import { useAuth } from '../../contexts/AuthContext';

interface PermissionItem {
  id: string;
  code: string;
  name: string;
  module: string;
}

interface VersionSummary {
  id: string;
  name: string;
  versionNumber: number;
  isCustom: boolean;
  permissionCount: number;
  positionCount: number;
}

interface PermissionGroupItem {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  permissionCount: number;
  positionCount: number;
  versions: VersionSummary[];
}

interface PositionItem {
  holderKind: string;
  holderId: string;
  label: string;
  nodeType?: string;
  nodeId?: string;
  includeSelf?: boolean;
}

const MODULE_LABELS: Record<string, string> = {
  setup: 'Thiết lập',
  user: 'Tài khoản',
  hr: 'Nhân sự',
  permission_group: 'Nhóm quyền',
  organization: 'Tổ chức',
};

const HOLDER_KIND_LABELS: Record<string, string> = {
  ORGANIZATION_REP: 'Đại diện tổ chức',
  COMPANY_REP: 'Đại diện công ty',
  UNIT_MANAGER: 'Phụ trách đơn vị',
  UNIT_MEMBER: 'Thành viên đơn vị',
};

function groupPermissionsByModule(items: PermissionItem[]) {
  return items.reduce<Record<string, PermissionItem[]>>((acc, item) => {
    if (!acc[item.module]) acc[item.module] = [];
    acc[item.module].push(item);
    return acc;
  }, {});
}

export function PermissionGroupsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PermissionGroupItem | null>(null);
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [positionDialogOpen, setPositionDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogPermissions, setDialogPermissions] = useState<Record<string, PermissionItem[]>>({});
  const [dialogPositions, setDialogPositions] = useState<PositionItem[]>([]);
  const [form] = Form.useForm();

  const {
    data: groupsData,
    isLoading: groupsLoading,
    isError: groupsError,
    error: groupsErr,
    refetch: refetchGroups,
  } = useQuery({
    queryKey: queryKeys.permissionGroups,
    queryFn: async () => {
      const { data } = await api.get<PermissionGroupItem[]>('/permission-groups');
      return data;
    },
  });

  const {
    data: permissions = [],
    isError: permsError,
    error: permsErr,
  } = useQuery({
    queryKey: queryKeys.permissionsCatalog,
    queryFn: async () => {
      const { data } = await api.get<{ items: PermissionItem[] }>('/permissions');
      return data.items;
    },
  });

  const groups = groupsData ?? [];
  const loading = groupsLoading;
  const permissionsByModule = useMemo(
    () => groupPermissionsByModule(permissions),
    [permissions],
  );

  useEffect(() => {
    if (groupsError) {
      message.error(getApiErrorMessage(groupsErr, 'Không tải được nhóm quyền'));
    }
    if (permsError) {
      message.error(getApiErrorMessage(permsErr, 'Không tải được danh mục quyền'));
    }
  }, [groupsError, groupsErr, permsError, permsErr]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.permissionGroups });
    void queryClient.invalidateQueries({ queryKey: queryKeys.permissionsCatalog });
  };

  const saveMutation = useMutation({
    mutationFn: async (values: { code?: string; name: string; permissionIds: string[] }) => {
      const payload = { ...values, permissionIds: values.permissionIds ?? [] };
      if (editingGroup) {
        await api.patch(`/permission-groups/${editingGroup.id}`, {
          name: payload.name,
          permissionIds: payload.permissionIds,
        });
      } else {
        await api.post('/permission-groups', payload);
      }
    },
    onSuccess: () => {
      message.success(editingGroup ? 'Cập nhật nhóm quyền thành công' : 'Tạo nhóm quyền thành công');
      setModalOpen(false);
      invalidate();
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (groupId: string) => api.delete(`/permission-groups/${groupId}`),
    onSuccess: () => {
      message.success('Đã xóa nhóm quyền');
      invalidate();
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const openCreate = async () => {
    setEditingGroup(null);
    form.resetFields();
    await refetchGroups();
    setModalOpen(true);
  };

  const openEdit = async (group: PermissionGroupItem) => {
    const { data } = await api.get<{ permissionIds: string[] }>(`/permission-groups/${group.id}`);
    setEditingGroup(group);
    form.setFieldsValue({
      name: group.name,
      code: group.code,
      permissionIds: data.permissionIds,
    });
    setModalOpen(true);
  };

  const openPermissionsDialog = async (versionId: string, title: string) => {
    const { data } = await api.get<{ permissions: Record<string, PermissionItem[]> }>(
      `/permission-groups/versions/${versionId}/permissions`,
    );
    setDialogTitle(title);
    setDialogPermissions(data.permissions);
    setPermDialogOpen(true);
  };

  const openPositionsDialog = async (versionId: string, title: string) => {
    const { data } = await api.get<{ positions?: PositionItem[]; accounts?: PositionItem[] }>(
      `/permission-groups/versions/${versionId}/accounts`,
    );
    setDialogTitle(title);
    setDialogPositions(data.positions ?? data.accounts ?? []);
    setPositionDialogOpen(true);
  };

  const handleSubmit = async (values: {
    code?: string;
    name: string;
    permissionIds: string[];
  }) => {
    await saveMutation.mutateAsync(values);
  };

  const handleDelete = (group: PermissionGroupItem) => {
    Modal.confirm({
      title: `Xóa nhóm quyền "${group.name}"?`,
      onOk: () => deleteMutation.mutateAsync(group.id),
    });
  };

  const tableData = groups.flatMap((group) => {
    const defaultVersion = group.versions.find((v) => !v.isCustom) ?? group.versions[0];
    const customVersions = group.versions.filter((v) => v.isCustom);
    const rows = [
      {
        key: group.id,
        rowType: 'group' as const,
        group,
        version: defaultVersion,
        indent: 0,
      },
      ...customVersions.map((version) => ({
        key: version.id,
        rowType: 'custom' as const,
        group,
        version,
        indent: 1,
      })),
    ];
    return rows;
  });

  return (
    <Card
      title="Nhóm quyền"
      data-testid="permission-groups-page"
      extra={
        hasPermission(Permissions.PERMISSION_GROUP_CREATE) && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm nhóm quyền
          </Button>
        )
      }
    >
      <Table
        rowKey="key"
        loading={loading}
        dataSource={tableData}
        pagination={false}
        columns={[
          {
            title: 'Tên nhóm',
            render: (_, record) => (
              <span style={{ paddingLeft: record.indent * 24 }}>
                {record.rowType === 'custom' && (
                  <Typography.Text type="secondary">↳ </Typography.Text>
                )}
                {record.version.name}
                {record.rowType === 'group' && record.group.isDefault && (
                  <Tag color="blue" style={{ marginLeft: 8 }}>
                    Mặc định
                  </Tag>
                )}
              </span>
            ),
          },
          {
            title: 'Danh mục quyền',
            render: (_, record) => (
              <Button
                type="link"
                size="small"
                onClick={() =>
                  openPermissionsDialog(record.version.id, `Quyền — ${record.version.name}`)
                }
              >
                {record.version.permissionCount} quyền
              </Button>
            ),
          },
          {
            title: 'Vị trí áp dụng',
            render: (_, record) => (
              <Button
                type="link"
                size="small"
                onClick={() =>
                  openPositionsDialog(record.version.id, `Vị trí — ${record.version.name}`)
                }
              >
                {record.version.positionCount} vị trí
              </Button>
            ),
          },
          {
            title: 'Thao tác',
            render: (_, record) =>
              record.rowType === 'group' ? (
                <Space>
                  {hasPermission(Permissions.PERMISSION_GROUP_UPDATE) && (
                    <Button size="small" onClick={() => openEdit(record.group)}>
                      Sửa
                    </Button>
                  )}
                  {hasPermission(Permissions.PERMISSION_GROUP_DELETE) &&
                    !record.group.isDefault && (
                      <Button size="small" danger onClick={() => handleDelete(record.group)}>
                        Xóa
                      </Button>
                    )}
                </Space>
              ) : null,
          },
        ]}
      />

      <Modal
        title={editingGroup ? 'Sửa nhóm quyền' : 'Thêm nhóm quyền'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        width={640}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {!editingGroup && (
            <Form.Item name="code" label="Mã nhóm" rules={[{ required: true }]}>
              <Input placeholder="custom_group" />
            </Form.Item>
          )}
          <Form.Item name="name" label="Tên nhóm" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="permissionIds" label="Quyền" rules={[{ required: true }]}>
            <Checkbox.Group style={{ width: '100%' }}>
              {Object.entries(permissionsByModule).map(([module, items]) => (
                <div key={module} style={{ marginBottom: 12 }}>
                  <Typography.Text strong>{MODULE_LABELS[module] ?? module}</Typography.Text>
                  <Divider style={{ margin: '8px 0' }} />
                  <Space direction="vertical">
                    {items.map((p) => (
                      <Checkbox key={p.id} value={p.id}>
                        {p.name}
                      </Checkbox>
                    ))}
                  </Space>
                </div>
              ))}
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={dialogTitle}
        open={permDialogOpen}
        onCancel={() => setPermDialogOpen(false)}
        footer={null}
        width={560}
      >
        <Collapse
          items={Object.entries(dialogPermissions).map(([module, items]) => ({
            key: module,
            label: `${MODULE_LABELS[module] ?? module} (${items.length})`,
            children: (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {items.map((p) => (
                  <li key={p.id}>{p.name}</li>
                ))}
              </ul>
            ),
          }))}
        />
      </Modal>

      <Modal
        title={dialogTitle}
        open={positionDialogOpen}
        onCancel={() => setPositionDialogOpen(false)}
        footer={null}
        width={640}
      >
        <Table
          rowKey={(r) => `${r.holderKind}:${r.holderId}`}
          size="small"
          dataSource={dialogPositions}
          pagination={false}
          columns={[
            { title: 'Vị trí', dataIndex: 'label' },
            {
              title: 'Loại',
              dataIndex: 'holderKind',
              render: (v: string) => HOLDER_KIND_LABELS[v] ?? v,
            },
            {
              title: 'Phạm vi',
              dataIndex: 'includeSelf',
              render: (v: boolean | undefined) =>
                v === false ? 'Không gồm cá nhân' : 'Chỉ cá nhân / có cá nhân',
            },
          ]}
        />
      </Modal>
    </Card>
  );
}
