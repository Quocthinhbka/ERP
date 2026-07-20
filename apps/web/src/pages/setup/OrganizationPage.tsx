import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Tree,
  Typography,
  message,
} from 'antd';
import type { DataNode, TreeProps } from 'antd/es/tree';
import {
  ApartmentOutlined,
  BankOutlined,
  ClusterOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { EntityStatus, OrgNodeType, OrgTreeNode, Permissions } from '@erp/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

interface TreeResponse {
  tree: OrgTreeNode;
  matchedKeys: string[];
}

interface UserOption {
  id: string;
  fullName: string;
  email: string;
  employeeCode: string | null;
}

type SelectedNode = {
  type: OrgNodeType;
  id: string;
  data: OrgTreeNode;
};

function nodeKey(node: { type: OrgNodeType | string; id: string }) {
  return `${node.type}:${node.id}`;
}

function statusTag(status: EntityStatus) {
  return status === EntityStatus.ACTIVE ? (
    <Tag color="green">Hoạt động</Tag>
  ) : (
    <Tag color="red">Ngưng</Tag>
  );
}

function toTreeData(node: OrgTreeNode, matchedKeys: Set<string>): DataNode {
  const key = nodeKey(node);
  return {
    key,
    title: (
      <Space size={4} wrap>
        <Typography.Text strong={matchedKeys.has(key)}>{node.name}</Typography.Text>
        <Typography.Text type="secondary">({node.code})</Typography.Text>
        {node.managerName && (
          <Typography.Text type="secondary">— {node.managerName}</Typography.Text>
        )}
        {statusTag(node.status)}
        {node.childCount > 0 && (
          <Typography.Text type="secondary">[{node.childCount} con]</Typography.Text>
        )}
      </Space>
    ),
    children: node.children.map((child) => toTreeData(child, matchedKeys)),
    selectable: true,
    isLeaf: node.children.length === 0,
    disabled: node.type === OrgNodeType.ORGANIZATION,
  };
}

function collectAllKeys(node: OrgTreeNode): string[] {
  const keys = [nodeKey(node)];
  for (const child of node.children) {
    keys.push(...collectAllKeys(child));
  }
  return keys;
}

function findUnitInTree(root: OrgTreeNode, unitId: string): OrgTreeNode | null {
  for (const company of root.children) {
    const walk = (nodes: OrgTreeNode[]): OrgTreeNode | null => {
      for (const node of nodes) {
        if (node.type === OrgNodeType.UNIT && node.id === unitId) {
          return node;
        }
        const found = walk(node.children);
        if (found) return found;
      }
      return null;
    };
    const found = walk(company.children);
    if (found) return found;
  }
  return null;
}

export function OrganizationPage() {
  const { hasPermission } = useAuth();
  const [treeData, setTreeData] = useState<OrgTreeNode | null>(null);
  const [matchedKeys, setMatchedKeys] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [form] = Form.useForm();

  const loadTree = useCallback(async (keyword?: string) => {
    setLoading(true);
    try {
      const { data } = await api.get<TreeResponse>('/organization/tree', {
        params: keyword ? { search: keyword } : undefined,
      });
      setTreeData(data.tree);
      setMatchedKeys(data.matchedKeys);
      if (data.matchedKeys.length > 0) {
        setExpandedKeys(data.matchedKeys);
      } else if (!keyword) {
        setExpandedKeys([nodeKey(data.tree)]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    const { data } = await api.get<{ items: UserOption[] }>('/users', {
      params: { pageSize: 200 },
    });
    setUsers(data.items);
  }, []);

  useEffect(() => {
    loadTree();
    loadUsers();
  }, [loadTree, loadUsers]);

  useEffect(() => {
    if (!selected) {
      form.resetFields();
      return;
    }
    const d = selected.data;
    form.setFieldsValue({
      name: d.name,
      code: d.code,
      description: d.description,
      managerName: d.managerName,
      managerEmployeeCode: d.managerEmployeeCode,
      managerUserId: d.managerUserId,
      displayOrder: d.displayOrder,
      status: d.status,
    });
  }, [selected, form]);

  const antTreeData = useMemo(() => {
    if (!treeData) return [];
    const matched = new Set(matchedKeys);
    return [toTreeData(treeData, matched)];
  }, [treeData, matchedKeys]);

  const handleSelect = (_keys: React.Key[], info: { node: DataNode }) => {
    const key = String(info.node.key);
    const [type, id] = key.split(':');
    const findNode = (node: OrgTreeNode): OrgTreeNode | null => {
      if (nodeKey(node) === key) return node;
      for (const child of node.children) {
        const found = findNode(child);
        if (found) return found;
      }
      return null;
    };
    if (!treeData) return;
    const data = findNode(treeData);
    if (!data || type === OrgNodeType.ORGANIZATION) {
      setSelected(null);
      return;
    }
    setSelected({ type: type as OrgNodeType, id, data });
  };

  const handleSave = async (values: Record<string, unknown>) => {
    if (!selected) return;
    try {
      if (selected.type === OrgNodeType.COMPANY) {
        await api.patch(`/organization/companies/${selected.id}`, values);
      } else if (selected.type === OrgNodeType.UNIT) {
        await api.patch(`/organization/units/${selected.id}`, values);
      }
      message.success('Lưu thành công');
      await loadTree(search || undefined);
    } catch {
      message.error('Lưu thất bại');
    }
  };

  const handleAddCompany = async () => {
    const name = window.prompt('Tên công ty');
    if (!name?.trim()) return;
    try {
      await api.post('/organization/companies', { name: name.trim() });
      message.success('Đã thêm công ty');
      await loadTree(search || undefined);
    } catch {
      message.error('Thêm công ty thất bại');
    }
  };

  const handleAddUnit = async () => {
    if (!selected || selected.type === OrgNodeType.ORGANIZATION) return;
    const name = window.prompt('Tên đơn vị');
    if (!name?.trim()) return;
    try {
      const payload =
        selected.type === OrgNodeType.COMPANY
          ? { companyId: selected.id, name: name.trim() }
          : {
              companyId: selected.data.companyId,
              parentUnitId: selected.id,
              name: name.trim(),
            };
      await api.post('/organization/units', payload);
      message.success('Đã thêm đơn vị');
      await loadTree(search || undefined);
    } catch {
      message.error('Thêm đơn vị thất bại');
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      if (selected.type === OrgNodeType.COMPANY) {
        await api.delete(`/organization/companies/${selected.id}`);
      } else {
        await api.delete(`/organization/units/${selected.id}`);
      }
      message.success('Đã xóa');
      setSelected(null);
      await loadTree(search || undefined);
    } catch {
      message.error('Không thể xóa — đơn vị có thể còn đơn vị con');
    }
  };

  const onDrop: TreeProps['onDrop'] = async (info) => {
    if (!hasPermission(Permissions.ORG_UNIT_MOVE) || !treeData) return;
    const dragKey = String(info.dragNode.key);
    if (!dragKey.startsWith(`${OrgNodeType.UNIT}:`)) {
      message.warning('Chỉ có thể kéo thả đơn vị tổ chức');
      return;
    }
    const dragId = dragKey.split(':')[1];
    const dropKey = String(info.node.key);
    let parentUnitId: string | null = null;

    if (dropKey.startsWith(`${OrgNodeType.COMPANY}:`)) {
      if (info.dropToGap) {
        message.warning('Không thể thả vào vị trí này');
        return;
      }
      parentUnitId = null;
    } else if (dropKey.startsWith(`${OrgNodeType.UNIT}:`)) {
      const dropUnitId = dropKey.split(':')[1];
      if (info.dropToGap) {
        const targetUnit = findUnitInTree(treeData, dropUnitId);
        parentUnitId = targetUnit?.parentUnitId ?? null;
      } else {
        parentUnitId = dropUnitId;
      }
    } else {
      message.warning('Không thể thả vào vị trí này');
      return;
    }

    try {
      await api.patch(`/organization/units/${dragId}/move`, { parentUnitId });
      message.success('Di chuyển thành công');
      await loadTree(search || undefined);
    } catch {
      message.error('Di chuyển thất bại');
    }
  };

  const handleUserLink = (userId: string | null) => {
    if (!userId) {
      return;
    }
    const user = users.find((u) => u.id === userId);
    if (user) {
      form.setFieldsValue({
        managerUserId: user.id,
        managerName: user.fullName,
        managerEmployeeCode: user.employeeCode,
      });
    }
  };

  return (
    <Card
      title="Thiết lập / Tổ chức"
      extra={
        <Space wrap>
          <Input.Search
            placeholder="Tìm theo tên, mã, người phụ trách..."
            allowClear
            onSearch={(value) => {
              setSearch(value);
              loadTree(value || undefined);
            }}
            style={{ width: 280 }}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => loadTree(search || undefined)}
          >
            Tải lại
          </Button>
          <Button
            onClick={() =>
              treeData && setExpandedKeys(collectAllKeys(treeData))
            }
          >
            Mở rộng
          </Button>
          <Button onClick={() => setExpandedKeys([])}>Thu gọn</Button>
          {hasPermission(Permissions.COMPANY_CREATE) && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCompany}>
              Thêm công ty
            </Button>
          )}
        </Space>
      }
    >
      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Spin spinning={loading}>
            {treeData ? (
              <Tree
                showLine
                blockNode
                draggable={
                  hasPermission(Permissions.ORG_UNIT_MOVE)
                    ? {
                        icon: false,
                        nodeDraggable: (node) =>
                          String(node.key).startsWith(`${OrgNodeType.UNIT}:`),
                      }
                    : false
                }
                expandedKeys={expandedKeys}
                onExpand={(keys) => setExpandedKeys(keys.map(String))}
                treeData={antTreeData}
                onSelect={handleSelect}
                onDrop={onDrop}
              />
            ) : (
              <Empty description="Chưa có dữ liệu tổ chức" />
            )}
          </Spin>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            size="small"
            title={
              selected ? (
                <Space>
                  {selected.type === OrgNodeType.COMPANY ? (
                    <BankOutlined />
                  ) : (
                    <ClusterOutlined />
                  )}
                  Chi tiết
                </Space>
              ) : (
                <Space>
                  <ApartmentOutlined />
                  Tổ chức
                </Space>
              )
            }
            extra={
              selected && (
                <Space>
                  {hasPermission(Permissions.ORG_UNIT_CREATE) &&
                    (selected.type === OrgNodeType.COMPANY ||
                      selected.type === OrgNodeType.UNIT) && (
                      <Button size="small" icon={<PlusOutlined />} onClick={handleAddUnit}>
                        Thêm đơn vị
                      </Button>
                    )}
                  {((selected.type === OrgNodeType.COMPANY &&
                    hasPermission(Permissions.COMPANY_DELETE)) ||
                    (selected.type === OrgNodeType.UNIT &&
                      hasPermission(Permissions.ORG_UNIT_DELETE))) && (
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={handleDelete}
                    >
                      Xóa
                    </Button>
                  )}
                </Space>
              )
            }
          >
            {selected ? (
              <Form form={form} layout="vertical" onFinish={handleSave}>
                <Form.Item label="Mã">
                  <Input value={selected.data.code} disabled />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Mã tự sinh: C01, C02 cho công ty; C01-001, C01-002 cho đơn vị
                  </Typography.Text>
                </Form.Item>
                <Form.Item name="name" label="Tên" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="description" label="Mô tả">
                  <Input.TextArea rows={2} />
                </Form.Item>
                <Form.Item name="managerName" label="Người phụ trách">
                  <Input placeholder="Nhập tên hiển thị" />
                </Form.Item>
                <Form.Item name="managerEmployeeCode" label="Mã nhân viên">
                  <Input placeholder="Nhập hoặc chọn liên kết bên dưới" />
                </Form.Item>
                <Form.Item name="managerUserId" label="Liên kết nhân viên (tùy chọn)">
                  <Select
                    allowClear
                    placeholder="Chọn user hệ thống"
                    options={users.map((u) => ({
                      value: u.id,
                      label: `${u.fullName}${u.employeeCode ? ` (${u.employeeCode})` : ''}`,
                    }))}
                    onChange={(value) => handleUserLink(value ?? null)}
                  />
                </Form.Item>
                <Form.Item name="displayOrder" label="Thứ tự hiển thị">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}>
                  <Select
                    options={[
                      { value: EntityStatus.ACTIVE, label: 'Hoạt động' },
                      { value: EntityStatus.INACTIVE, label: 'Ngưng' },
                    ]}
                  />
                </Form.Item>
                {(hasPermission(Permissions.COMPANY_UPDATE) ||
                  hasPermission(Permissions.ORG_UNIT_UPDATE)) && (
                  <Button type="primary" htmlType="submit" block>
                    Lưu
                  </Button>
                )}
              </Form>
            ) : treeData ? (
              <Space direction="vertical">
                <Typography.Text>
                  <strong>{treeData.name}</strong> ({treeData.code})
                </Typography.Text>
                <Typography.Text type="secondary">
                  {treeData.description ?? 'Tổ chức gốc của hệ thống'}
                </Typography.Text>
                {statusTag(treeData.status)}
                <Typography.Text type="secondary">
                  {treeData.childCount} công ty
                </Typography.Text>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  Chọn công ty hoặc đơn vị trên cây để xem/chỉnh sửa.
                </Typography.Paragraph>
              </Space>
            ) : null}
          </Card>
        </Col>
      </Row>
    </Card>
  );
}
