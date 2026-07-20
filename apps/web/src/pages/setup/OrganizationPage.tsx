import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Empty,
  Form,
  Grid,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Tree,
  Typography,
  message,
} from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  ApartmentOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  BankOutlined,
  ClusterOutlined,
  DeleteOutlined,
  EditOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { EntityStatus, OrgMember, OrgNodeType, OrgTreeNode, Permissions } from '@erp/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { OrganizationIoActions } from './OrganizationIoActions';

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

const HEADER_HEIGHT = 48;
const CONTENT_VERTICAL_CHROME = 48;
const ORG_PAGE_HEIGHT = `calc(100vh - ${HEADER_HEIGHT + CONTENT_VERTICAL_CHROME}px)`;

type SelectedNode = {
  type: OrgNodeType;
  id: string;
  data: OrgTreeNode;
};

function nodeKey(node: { type: OrgNodeType | string; id: string }) {
  return `${node.type}:${node.id}`;
}

function statusTag(status?: EntityStatus) {
  if (!status) return null;
  return status === EntityStatus.ACTIVE ? (
    <Tag color="green">Hoạt động</Tag>
  ) : (
    <Tag color="red">Ngưng</Tag>
  );
}

function findNodeInTree(root: OrgTreeNode, key: string): OrgTreeNode | null {
  if (nodeKey(root) === key) return root;
  for (const child of root.children) {
    const found = findNodeInTree(child, key);
    if (found) return found;
  }
  return null;
}

function displayText(value: string | null | undefined) {
  return value?.trim() ? value : '—';
}

function displayManagerName(value: string | null | undefined) {
  return value?.trim() ? value : 'Chưa có phụ trách';
}

function personLabel(node: OrgTreeNode) {
  if (node.type === OrgNodeType.UNIT) {
    return displayManagerName(node.managerName);
  }
  return node.representativeName;
}

function toTreeData(node: OrgTreeNode, matchedKeys: Set<string>): DataNode {
  const key = nodeKey(node);
  const person = personLabel(node);
  return {
    key,
    title: (
      <Space size={4} wrap>
        <Typography.Text strong={matchedKeys.has(key)}>{node.name}</Typography.Text>
        {node.type === OrgNodeType.UNIT ? (
          <Typography.Text type="secondary">— {person}</Typography.Text>
        ) : (
          person && <Typography.Text type="secondary">— {person}</Typography.Text>
        )}
        {statusTag(node.status)}
      </Space>
    ),
    children: node.children.map((child) => toTreeData(child, matchedKeys)),
    selectable: true,
    isLeaf: node.children.length === 0,
  };
}

function collectAllKeys(node: OrgTreeNode): string[] {
  const keys = [nodeKey(node)];
  for (const child of node.children) {
    keys.push(...collectAllKeys(child));
  }
  return keys;
}

function findParentNode(root: OrgTreeNode, targetKey: string): OrgTreeNode | null {
  if (nodeKey(root) === targetKey) return null;
  for (const child of root.children) {
    if (nodeKey(child) === targetKey) return root;
    const found = findParentNode(child, targetKey);
    if (found) return found;
  }
  return null;
}

function getSiblingInfo(tree: OrgTreeNode, selected: SelectedNode) {
  if (selected.type === OrgNodeType.ORGANIZATION) return null;
  const parent =
    selected.type === OrgNodeType.COMPANY
      ? tree
      : findParentNode(tree, nodeKey(selected));
  if (!parent) return null;
  const index = parent.children.findIndex((child) => child.id === selected.id);
  if (index === -1) return null;
  return { index, total: parent.children.length };
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string | string[] } } }).response;
    const msg = response?.data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
}

function userSelectOptions(users: UserOption[]) {
  return users.map((u) => ({
    value: u.id,
    label: `${u.fullName}${u.employeeCode ? ` (${u.employeeCode})` : ''}`,
  }));
}

function memberFieldsToForm(members?: OrgMember[]) {
  return (members ?? []).map((m) => ({
    position: m.position,
    memberName: m.memberName,
    phone: m.phone ?? undefined,
    email: m.email ?? undefined,
    additionalInfo: m.additionalInfo ?? undefined,
    linkedProfileUserId: m.linkedProfileUserId ?? undefined,
  }));
}

function nodeToFormValues(node: OrgTreeNode) {
  if (node.type === OrgNodeType.ORGANIZATION) {
    return {
      name: node.name,
      representativeName: node.representativeName,
      linkedProfileUserId: node.linkedProfileUserId,
      additionalInfo: node.additionalInfo,
      members: memberFieldsToForm(node.members),
    };
  }
  if (node.type === OrgNodeType.COMPANY) {
    return {
      name: node.name,
      taxId: node.taxId,
      address: node.address,
      representativeName: node.representativeName,
      linkedProfileUserId: node.linkedProfileUserId,
      phone: node.phone,
      email: node.email,
      status: node.status ?? EntityStatus.ACTIVE,
      members: memberFieldsToForm(node.members),
    };
  }
  return {
    name: node.name,
    managerName: node.managerName,
    linkedProfileUserId: node.linkedProfileUserId,
    status: node.status ?? EntityStatus.ACTIVE,
    additionalInfo: node.additionalInfo,
    members: memberFieldsToForm(node.members),
  };
}

function MembersFormList({
  withLinkedProfile,
  users,
}: {
  withLinkedProfile?: boolean;
  users: UserOption[];
}) {
  return (
    <Form.List name="members">
      {(fields, { add, remove }) => (
        <>
          <Typography.Text strong>Danh sách thành viên</Typography.Text>
          {fields.map(({ key, name, ...restField }) => (
            <Card key={key} size="small" style={{ marginTop: 8 }}>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item
                    {...restField}
                    name={[name, 'position']}
                    label="Chức vụ"
                    rules={[{ required: true, message: 'Nhập chức vụ' }]}
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    {...restField}
                    name={[name, 'memberName']}
                    label="Tên thành viên"
                    rules={[{ required: true, message: 'Nhập tên' }]}
                  >
                    <Input />
                  </Form.Item>
                </Col>
                {withLinkedProfile && (
                  <Col span={24}>
                    <Form.Item
                      {...restField}
                      name={[name, 'linkedProfileUserId']}
                      label="Hồ sơ liên kết"
                    >
                      <Select allowClear placeholder="Chọn user hệ thống" options={userSelectOptions(users)} />
                    </Form.Item>
                  </Col>
                )}
                <Col span={12}>
                  <Form.Item {...restField} name={[name, 'phone']} label="Số điện thoại">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item {...restField} name={[name, 'email']} label="Email">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item {...restField} name={[name, 'additionalInfo']} label="Thông tin thêm">
                    <Input.TextArea rows={2} />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)}>
                    Xóa thành viên
                  </Button>
                </Col>
              </Row>
            </Card>
          ))}
          <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add()} style={{ marginTop: 8 }}>
            Thêm thành viên
          </Button>
        </>
      )}
    </Form.List>
  );
}

function EmployeesViewList({ members }: { members?: OrgMember[] }) {
  if (!members?.length) {
    return <Typography.Text type="secondary">Chưa có nhân viên</Typography.Text>;
  }
  return (
    <Collapse
      items={members.map((m) => ({
        key: m.id,
        label: `${m.position}: ${m.memberName}`,
        children: (
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Chức vụ">{m.position}</Descriptions.Item>
            <Descriptions.Item label="Tên nhân viên">{m.memberName}</Descriptions.Item>
            <Descriptions.Item label="Hồ sơ liên kết">
              {displayText(m.linkedProfileName)}
            </Descriptions.Item>
            <Descriptions.Item label="Số điện thoại">{displayText(m.phone)}</Descriptions.Item>
            <Descriptions.Item label="Email">{displayText(m.email)}</Descriptions.Item>
            <Descriptions.Item label="Thông tin thêm">{displayText(m.additionalInfo)}</Descriptions.Item>
          </Descriptions>
        ),
      }))}
    />
  );
}

function MembersViewList({ members, withLinkedProfile }: { members?: OrgMember[]; withLinkedProfile?: boolean }) {
  if (!members?.length) {
    return <Typography.Text type="secondary">Chưa có thành viên</Typography.Text>;
  }
  return (
    <Collapse
      items={members.map((m) => ({
        key: m.id,
        label: `${m.position}: ${m.memberName}`,
        children: (
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Chức vụ">{m.position}</Descriptions.Item>
            <Descriptions.Item label="Tên thành viên">{m.memberName}</Descriptions.Item>
            {withLinkedProfile && (
              <Descriptions.Item label="Hồ sơ liên kết">
                {displayText(m.linkedProfileName)}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Số điện thoại">{displayText(m.phone)}</Descriptions.Item>
            <Descriptions.Item label="Email">{displayText(m.email)}</Descriptions.Item>
            <Descriptions.Item label="Thông tin thêm">{displayText(m.additionalInfo)}</Descriptions.Item>
          </Descriptions>
        ),
      }))}
    />
  );
}

export function OrganizationPage() {
  const { hasPermission } = useAuth();
  const screens = Grid.useBreakpoint();
  const isDesktopLayout = !!screens.lg;
  const [treeData, setTreeData] = useState<OrgTreeNode | null>(null);
  const [matchedKeys, setMatchedKeys] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [employeeForm] = Form.useForm();

  const loadTree = useCallback(async (keyword?: string): Promise<OrgTreeNode | null> => {
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
      return data.tree;
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
    setIsEditing(false);
    if (!selected) {
      form.resetFields();
      return;
    }
    form.setFieldsValue(nodeToFormValues(selected.data));
  }, [selected, form]);

  const canUpdateSelected =
    !!selected &&
    ((selected.type === OrgNodeType.ORGANIZATION &&
      hasPermission(Permissions.ORGANIZATION_MANAGE)) ||
      (selected.type === OrgNodeType.COMPANY && hasPermission(Permissions.COMPANY_UPDATE)) ||
      (selected.type === OrgNodeType.UNIT && hasPermission(Permissions.ORG_UNIT_UPDATE)));

  const linkedUserLabel = (userId?: string | null, fallbackName?: string | null) => {
    if (userId) {
      const user = users.find((u) => u.id === userId);
      if (user) {
        return `${user.fullName}${user.employeeCode ? ` (${user.employeeCode})` : ''}`;
      }
    }
    return displayText(fallbackName);
  };

  const antTreeData = useMemo(() => {
    if (!treeData) return [];
    const matched = new Set(matchedKeys);
    return [toTreeData(treeData, matched)];
  }, [treeData, matchedKeys]);

  const siblingInfo = useMemo(() => {
    if (!treeData || !selected) return null;
    return getSiblingInfo(treeData, selected);
  }, [treeData, selected]);

  const canReorderSelected =
    !!selected &&
    (selected.type === OrgNodeType.COMPANY || selected.type === OrgNodeType.UNIT) &&
    hasPermission(Permissions.ORG_UNIT_MOVE);

  const isLeafUnit =
    selected?.type === OrgNodeType.UNIT && selected.data.childCount === 0;

  const canDeleteUnit =
    selected?.type === OrgNodeType.UNIT &&
    selected.data.childCount === 0 &&
    (selected.data.members?.length ?? 0) === 0;

  const canShowAddUnit =
    !!selected &&
    !isEditing &&
    hasPermission(Permissions.ORG_UNIT_CREATE) &&
    (selected.type === OrgNodeType.COMPANY ||
      (selected.type === OrgNodeType.UNIT && (selected.data.members?.length ?? 0) === 0));

  const renderPanelExtra = () => {
    if (!selected) return null;

    const showReorder = canReorderSelected && !isEditing && siblingInfo;
    const canMoveUp = !!siblingInfo && siblingInfo.index > 0;
    const canMoveDown = !!siblingInfo && siblingInfo.index < siblingInfo.total - 1;

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          width: '100%',
        }}
      >
        <Space wrap size={4}>
          {selected.type === OrgNodeType.ORGANIZATION &&
            hasPermission(Permissions.COMPANY_CREATE) &&
            !isEditing && (
              <Button size="small" type="primary" icon={<PlusOutlined />} onClick={handleAddCompany}>
                Thêm công ty
              </Button>
            )}
          {isLeafUnit && hasPermission(Permissions.ORG_UNIT_UPDATE) && !isEditing && (
            <Button size="small" icon={<PlusOutlined />} onClick={() => setEmployeeModalOpen(true)}>
              Thêm nhân viên
            </Button>
          )}
          {canShowAddUnit && (
            <Button size="small" icon={<PlusOutlined />} onClick={handleAddUnit}>
              Thêm đơn vị
            </Button>
          )}
          {canUpdateSelected && !isEditing && (
            <Button size="small" icon={<EditOutlined />} title="Sửa" onClick={() => setIsEditing(true)}>
              Sửa
            </Button>
          )}
          {selected.type === OrgNodeType.COMPANY && hasPermission(Permissions.COMPANY_DELETE) && (
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              title="Xóa"
              onClick={handleDelete}
            >
              Xóa
            </Button>
          )}
          {selected.type === OrgNodeType.UNIT &&
            hasPermission(Permissions.ORG_UNIT_DELETE) &&
            canDeleteUnit && (
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                title="Xóa"
                onClick={handleDelete}
              >
                Xóa
              </Button>
            )}
        </Space>
        {showReorder && (
          <Space size={4} style={{ marginLeft: 8, flexShrink: 0 }}>
            <Button
              size="small"
              icon={<ArrowUpOutlined />}
              title="Lên trên"
              disabled={!canMoveUp}
              onClick={() => handleReorder('up')}
            />
            <Button
              size="small"
              icon={<ArrowDownOutlined />}
              title="Xuống dưới"
              disabled={!canMoveDown}
              onClick={() => handleReorder('down')}
            />
          </Space>
        )}
      </div>
    );
  };

  const handleSelect = (_keys: React.Key[], info: { node: DataNode }) => {
    const key = String(info.node.key);
    const [type, id] = key.split(':');
    if (!treeData) return;
    const data = findNodeInTree(treeData, key);
    if (!data) return;
    setIsEditing(false);
    setSelected({ type: type as OrgNodeType, id, data });
  };

  const refreshSelection = async (type: OrgNodeType, id: string) => {
    const tree = await loadTree(search || undefined);
    if (!tree) return;
    const updated = findNodeInTree(tree, nodeKey({ type, id }));
    if (updated) {
      setSelected({ type, id, data: updated });
    }
  };

  const handleSave = async (values: Record<string, unknown>) => {
    if (!selected) return;
    try {
      if (selected.type === OrgNodeType.ORGANIZATION) {
        await api.patch('/organization', values);
      } else if (selected.type === OrgNodeType.COMPANY) {
        await api.patch(`/organization/companies/${selected.id}`, values);
      } else {
        await api.patch(`/organization/units/${selected.id}`, values);
      }
      message.success('Lưu thành công');
      setIsEditing(false);
      await refreshSelection(selected.type, selected.id);
    } catch {
      message.error('Lưu thất bại');
    }
  };

  const handleCancelEdit = () => {
    if (!selected) return;
    form.setFieldsValue(nodeToFormValues(selected.data));
    setIsEditing(false);
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
    if (!selected || selected.type === OrgNodeType.ORGANIZATION) return;
    if (selected.type === OrgNodeType.UNIT && !canDeleteUnit) {
      message.warning('Chỉ xóa được khi đơn vị không còn nhân viên và không có đơn vị con');
      return;
    }
    try {
      if (selected.type === OrgNodeType.COMPANY) {
        await api.delete(`/organization/companies/${selected.id}`);
      } else {
        await api.delete(`/organization/units/${selected.id}`);
      }
      message.success('Đã xóa');
      setSelected(null);
      await loadTree(search || undefined);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể xóa'));
    }
  };

  const handleReorder = async (direction: 'up' | 'down') => {
    if (!selected) return;
    try {
      const endpoint =
        selected.type === OrgNodeType.COMPANY
          ? `/organization/companies/${selected.id}/reorder`
          : `/organization/units/${selected.id}/reorder`;
      await api.patch(endpoint, { direction });
      message.success('Đã cập nhật thứ tự');
      await refreshSelection(selected.type, selected.id);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể đổi thứ tự'));
    }
  };

  const handleAddEmployee = async (values: Record<string, unknown>) => {
    if (!selected || selected.type !== OrgNodeType.UNIT) return;
    const currentMembers = memberFieldsToForm(selected.data.members);
    try {
      await api.patch(`/organization/units/${selected.id}`, {
        members: [...currentMembers, values],
      });
      message.success('Đã thêm nhân viên');
      setEmployeeModalOpen(false);
      employeeForm.resetFields();
      await refreshSelection(selected.type, selected.id);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Thêm nhân viên thất bại'));
    }
  };

  const renderEditForm = () => {
    if (!selected) return null;
    const userOptions = userSelectOptions(users);
    if (selected.type === OrgNodeType.ORGANIZATION) {
      return (
        <>
          <Form.Item name="name" label="Tên tổ chức" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="representativeName" label="Người đại diện">
            <Input />
          </Form.Item>
          <Form.Item name="linkedProfileUserId" label="Hồ sơ liên kết">
            <Select allowClear placeholder="Chọn user hệ thống" options={userOptions} />
          </Form.Item>
          <Form.Item name="additionalInfo" label="Thông tin thêm">
            <Input.TextArea rows={3} />
          </Form.Item>
          <MembersFormList users={users} />
        </>
      );
    }
    if (selected.type === OrgNodeType.COMPANY) {
      return (
        <>
          <Form.Item name="name" label="Tên công ty" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="taxId" label="Mã số thuế">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Địa chỉ">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="representativeName" label="Người đại diện">
            <Input />
          </Form.Item>
          <Form.Item name="linkedProfileUserId" label="Hồ sơ liên kết">
            <Select allowClear placeholder="Chọn user hệ thống" options={userOptions} />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="status" label="Trạng thái hoạt động" rules={[{ required: true }]}>
            <Select
              options={[
                { value: EntityStatus.ACTIVE, label: 'Hoạt động' },
                { value: EntityStatus.INACTIVE, label: 'Ngưng' },
              ]}
            />
          </Form.Item>
          <MembersFormList withLinkedProfile users={users} />
        </>
      );
    }
    return (
      <>
        <Form.Item name="name" label="Tên đơn vị" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="managerName" label="Người phụ trách">
          <Input />
        </Form.Item>
        <Form.Item name="linkedProfileUserId" label="Hồ sơ liên kết">
          <Select allowClear placeholder="Chọn user hệ thống" options={userOptions} />
        </Form.Item>
        <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}>
          <Select
            options={[
              { value: EntityStatus.ACTIVE, label: 'Hoạt động' },
              { value: EntityStatus.INACTIVE, label: 'Ngưng' },
            ]}
          />
        </Form.Item>
        <Form.Item name="additionalInfo" label="Thông tin thêm">
          <Input.TextArea rows={3} />
        </Form.Item>
      </>
    );
  };

  const renderViewPanel = () => {
    if (!selected) return null;
    const d = selected.data;
    if (selected.type === OrgNodeType.ORGANIZATION) {
      return (
        <>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Tên tổ chức">{d.name}</Descriptions.Item>
            <Descriptions.Item label="Người đại diện">{displayText(d.representativeName)}</Descriptions.Item>
            <Descriptions.Item label="Hồ sơ liên kết">
              {linkedUserLabel(d.linkedProfileUserId, d.linkedProfileName)}
            </Descriptions.Item>
            <Descriptions.Item label="Thông tin thêm">{displayText(d.additionalInfo)}</Descriptions.Item>
          </Descriptions>
          <Typography.Title level={5} style={{ marginTop: 16 }}>
            Danh sách thành viên
          </Typography.Title>
          <MembersViewList members={d.members} />
        </>
      );
    }
    if (selected.type === OrgNodeType.COMPANY) {
      return (
        <>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Tên công ty">{d.name}</Descriptions.Item>
            <Descriptions.Item label="Mã số thuế">{displayText(d.taxId)}</Descriptions.Item>
            <Descriptions.Item label="Địa chỉ">{displayText(d.address)}</Descriptions.Item>
            <Descriptions.Item label="Người đại diện">{displayText(d.representativeName)}</Descriptions.Item>
            <Descriptions.Item label="Hồ sơ liên kết">
              {linkedUserLabel(d.linkedProfileUserId, d.linkedProfileName)}
            </Descriptions.Item>
            <Descriptions.Item label="Số điện thoại">{displayText(d.phone)}</Descriptions.Item>
            <Descriptions.Item label="Email">{displayText(d.email)}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái hoạt động">{statusTag(d.status)}</Descriptions.Item>
          </Descriptions>
          <Typography.Title level={5} style={{ marginTop: 16 }}>
            Danh sách thành viên
          </Typography.Title>
          <MembersViewList members={d.members} withLinkedProfile />
        </>
      );
    }
    return (
      <>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Tên đơn vị">{d.name}</Descriptions.Item>
          <Descriptions.Item label="Người phụ trách">{displayManagerName(d.managerName)}</Descriptions.Item>
          <Descriptions.Item label="Hồ sơ liên kết">
            {linkedUserLabel(d.linkedProfileUserId, d.linkedProfileName)}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái">{statusTag(d.status)}</Descriptions.Item>
          <Descriptions.Item label="Thông tin thêm">{displayText(d.additionalInfo)}</Descriptions.Item>
        </Descriptions>
        {isLeafUnit && (
          <>
            <Typography.Title level={5} style={{ marginTop: 16 }}>
              Danh sách nhân viên
            </Typography.Title>
            <EmployeesViewList members={d.members} />
          </>
        )}
      </>
    );
  };

  const panelTitle = () => {
    if (!selected) {
      return (
        <Space>
          <ApartmentOutlined />
          Tổ chức
        </Space>
      );
    }
    const icon =
      selected.type === OrgNodeType.ORGANIZATION ? (
        <ApartmentOutlined />
      ) : selected.type === OrgNodeType.COMPANY ? (
        <BankOutlined />
      ) : (
        <ClusterOutlined />
      );
    return (
      <Space>
        {icon}
        {selected.type === OrgNodeType.ORGANIZATION ? 'Tổ chức' : 'Chi tiết'}
      </Space>
    );
  };

  return (
    <div
      style={
        isDesktopLayout
          ? {
              height: ORG_PAGE_HEIGHT,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }
          : undefined
      }
    >
      <Card
        title="Thiết lập / Tổ chức"
        style={
          isDesktopLayout
            ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }
            : undefined
        }
        styles={
          isDesktopLayout
            ? { body: { flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' } }
            : undefined
        }
        extra={
          <Space wrap>
            <Input.Search
              placeholder="Tìm theo tên, người đại diện/phụ trách..."
              allowClear
              onSearch={(value) => {
                setSearch(value);
                loadTree(value || undefined);
              }}
              style={{ width: 280 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => loadTree(search || undefined)}>
              Tải lại
            </Button>
            <Button onClick={() => treeData && setExpandedKeys(collectAllKeys(treeData))}>
              Mở rộng
            </Button>
            <Button onClick={() => setExpandedKeys([])}>Thu gọn</Button>
            <OrganizationIoActions
              canExport={hasPermission(Permissions.ORGANIZATION_VIEW)}
              canImport={hasPermission(Permissions.ORGANIZATION_MANAGE)}
              onApplied={() => loadTree(search || undefined)}
            />
          </Space>
        }
      >
        <Row
          gutter={16}
          style={isDesktopLayout ? { flex: 1, minHeight: 0, height: '100%' } : undefined}
        >
          <Col
            xs={24}
            lg={14}
            style={isDesktopLayout ? { height: '100%', minHeight: 0, overflow: 'auto' } : undefined}
          >
            <Spin spinning={loading}>
              {treeData ? (
                <Tree
                  showLine
                  blockNode
                  expandedKeys={expandedKeys}
                  onExpand={(keys) => setExpandedKeys(keys.map(String))}
                  treeData={antTreeData}
                  onSelect={handleSelect}
                />
              ) : (
                <Empty description="Chưa có dữ liệu tổ chức" />
              )}
            </Spin>
          </Col>
          <Col
            xs={24}
            lg={10}
            style={
              isDesktopLayout
                ? { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }
                : undefined
            }
          >
            <Card
              size="small"
              style={
                isDesktopLayout
                  ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }
                  : undefined
              }
              styles={
                isDesktopLayout
                  ? { body: { flex: 1, minHeight: 0, overflowY: 'auto' } }
                  : undefined
              }
              title={panelTitle()}
              extra={renderPanelExtra()}
            >
              {selected ? (
                isEditing ? (
                  <Form form={form} layout="vertical" onFinish={handleSave}>
                    {renderEditForm()}
                    <Space style={{ width: '100%', marginTop: 16 }}>
                      <Button type="primary" htmlType="submit">
                        Lưu
                      </Button>
                      <Button onClick={handleCancelEdit}>Hủy</Button>
                    </Space>
                  </Form>
                ) : (
                  renderViewPanel()
                )
              ) : treeData ? (
                <Space direction="vertical">
                  <Typography.Text>
                    <strong>{treeData.name}</strong>
                  </Typography.Text>
                  {treeData.representativeName && (
                    <Typography.Text type="secondary">
                      Người đại diện: {treeData.representativeName}
                    </Typography.Text>
                  )}
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    Chọn tổ chức, công ty hoặc đơn vị trên cây để xem/chỉnh sửa.
                  </Typography.Paragraph>
                </Space>
              ) : null}
            </Card>
          </Col>
        </Row>
      </Card>
      <Modal
        title="Thêm nhân viên"
        open={employeeModalOpen}
        onCancel={() => {
          setEmployeeModalOpen(false);
          employeeForm.resetFields();
        }}
        onOk={() => employeeForm.submit()}
        okText="Lưu"
        cancelText="Hủy"
        destroyOnClose
      >
        <Form form={employeeForm} layout="vertical" onFinish={handleAddEmployee}>
          <Form.Item name="position" label="Chức vụ" rules={[{ required: true, message: 'Nhập chức vụ' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="memberName"
            label="Tên nhân viên"
            rules={[{ required: true, message: 'Nhập tên nhân viên' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="linkedProfileUserId" label="Hồ sơ liên kết">
            <Select allowClear placeholder="Chọn user hệ thống" options={userSelectOptions(users)} />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="additionalInfo" label="Thông tin thêm">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
