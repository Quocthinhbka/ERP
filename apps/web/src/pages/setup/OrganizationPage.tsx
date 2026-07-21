import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
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
import type { NamePath } from 'antd/es/form/interface';
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
  UserOutlined,
} from '@ant-design/icons';
import {
  EntityStatus,
  OrgMember,
  OrgNodeType,
  OrgTreeNode,
  Permissions,
  PositionPermissionSummary,
} from '@erp/shared';
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
  phone: string | null;
  accountCode: string;
}

interface PermissionGroupOption {
  id: string;
  name: string;
  versions: Array<{ id: string; name: string; isCustom: boolean }>;
}

interface AncestorOption {
  type: OrgNodeType;
  id: string;
  name: string;
}

interface PositionPermissionFormValue {
  permissionGroupVersionId?: string;
  includeSelf?: boolean;
  parentScopeKeys?: string[];
}

const HEADER_HEIGHT = 48;
const CONTENT_VERTICAL_CHROME = 48;
const ORG_PAGE_HEIGHT = `calc(100vh - ${HEADER_HEIGHT + CONTENT_VERTICAL_CHROME}px)`;

type SelectedNode = {
  type: OrgNodeType;
  id: string;
  data: OrgTreeNode;
  member?: OrgMember;
};

const UNIT_MEMBER_KEY_PREFIX = 'unit-member:';

function nodeKey(node: { type: OrgNodeType | string; id: string }) {
  return `${node.type}:${node.id}`;
}

function unitMemberKey(memberId: string) {
  return `${UNIT_MEMBER_KEY_PREFIX}${memberId}`;
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

function findUnitMemberInTree(
  root: OrgTreeNode,
  memberId: string,
): { unit: OrgTreeNode; member: OrgMember } | null {
  if (root.type === OrgNodeType.UNIT) {
    const member = root.members?.find((m) => m.id === memberId);
    if (member) {
      return { unit: root, member };
    }
  }
  for (const child of root.children) {
    const found = findUnitMemberInTree(child, memberId);
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
  const orgChildren = node.children.map((child) => toTreeData(child, matchedKeys));
  const isLeafUnit =
    node.type === OrgNodeType.UNIT &&
    orgChildren.length === 0 &&
    (node.isLeaf ?? node.childCount === 0);

  const memberChildren: DataNode[] =
    isLeafUnit && node.members?.length
      ? node.members.map((m) => ({
          key: unitMemberKey(m.id),
          title: (
            <span>
              <Typography.Text strong style={{ color: 'rgba(0, 0, 0, 0.88)' }}>
                {m.position}
              </Typography.Text>
              <Typography.Text type="secondary"> - </Typography.Text>
              <Typography.Text type="secondary">{m.memberName}</Typography.Text>
            </span>
          ),
          selectable: true,
          isLeaf: true,
          children: [],
        }))
      : [];

  const children = [...orgChildren, ...memberChildren];
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
    children,
    selectable: true,
    isLeaf: children.length === 0,
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
    label: `${u.fullName} (${u.accountCode})`,
  }));
}

/** Khi chọn hồ sơ liên kết, tự điền họ tên / SĐT / email lên form. */
function LinkedProfileSelect({
  users,
  nameField,
  phoneField,
  emailField,
  value,
  onChange,
}: {
  users: UserOption[];
  nameField?: NamePath;
  phoneField?: NamePath;
  emailField?: NamePath;
  value?: string;
  onChange?: (value: string | undefined) => void;
}) {
  const form = Form.useFormInstance();
  return (
    <Select
      allowClear
      showSearch
      optionFilterProp="label"
      placeholder="Chọn user hệ thống"
      options={userSelectOptions(users)}
      value={value}
      onChange={(userId: string | undefined) => {
        onChange?.(userId);
        if (!userId) return;
        const user = users.find((u) => u.id === userId);
        if (!user) return;
        if (nameField !== undefined) {
          form.setFieldValue(nameField, user.fullName);
        }
        if (phoneField !== undefined) {
          form.setFieldValue(phoneField, user.phone ?? undefined);
        }
        if (emailField !== undefined) {
          form.setFieldValue(emailField, user.email);
        }
      }}
    />
  );
}

function scopeTypeLabel(type: OrgNodeType | string) {
  if (type === OrgNodeType.ORGANIZATION || type === 'organization') return 'Tổ chức';
  if (type === OrgNodeType.COMPANY || type === 'company') return 'Công ty';
  return 'Đơn vị';
}

function findPathToNode(
  root: OrgTreeNode,
  targetKey: string,
  path: OrgTreeNode[] = [],
): OrgTreeNode[] | null {
  const next = [...path, root];
  if (nodeKey(root) === targetKey) return next;
  for (const child of root.children) {
    const found = findPathToNode(child, targetKey, next);
    if (found) return found;
  }
  return null;
}

function getAncestorOptions(tree: OrgTreeNode | null, targetKey: string): AncestorOption[] {
  if (!tree) return [];
  const path = findPathToNode(tree, targetKey);
  if (!path || path.length <= 1) return [];
  return path.slice(0, -1).map((n) => ({ type: n.type, id: n.id, name: n.name }));
}

function positionPermissionToForm(
  pp?: PositionPermissionSummary | null,
): PositionPermissionFormValue {
  if (!pp) {
    return { includeSelf: true, parentScopeKeys: [] };
  }
  return {
    permissionGroupVersionId: pp.permissionGroupVersionId,
    includeSelf: pp.includeSelf,
    parentScopeKeys: pp.parentScopes.map((s) => `${s.type}:${s.id}`),
  };
}

function positionPermissionToPayload(formValue?: PositionPermissionFormValue | null) {
  if (!formValue?.permissionGroupVersionId) {
    return null;
  }
  return {
    permissionGroupVersionId: formValue.permissionGroupVersionId,
    includeSelf: formValue.includeSelf ?? true,
    parentScopes: (formValue.parentScopeKeys ?? []).map((key) => {
      const [type, id] = key.split(':');
      return { type: type as 'organization' | 'company' | 'unit', id };
    }),
  };
}

function formatPositionPermissionSummary(pp?: PositionPermissionSummary | null) {
  if (!pp) return 'Chưa gán';
  const scopes: string[] = [];
  if (pp.includeSelf) scopes.push('Chỉ cá nhân');
  for (const s of pp.parentScopes) {
    scopes.push(scopeTypeLabel(s.type));
  }
  return `${pp.permissionGroupName}${scopes.length ? ` — ${scopes.join(', ')}` : ''}`;
}

function memberFieldsToForm(members?: OrgMember[], withPositionPermission = false) {
  return (members ?? []).map((m) => ({
    id: m.id,
    position: m.position,
    memberName: m.memberName,
    phone: m.phone ?? undefined,
    email: m.email ?? undefined,
    additionalInfo: m.additionalInfo ?? undefined,
    linkedProfileUserId: m.linkedProfileUserId ?? undefined,
    ...(withPositionPermission
      ? { positionPermission: positionPermissionToForm(m.positionPermission) }
      : {}),
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
      positionPermission: positionPermissionToForm(node.positionPermission),
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
      positionPermission: positionPermissionToForm(node.positionPermission),
    };
  }
  const isLeaf = node.isLeaf ?? node.childCount === 0;
  return {
    name: node.name,
    managerName: node.managerName,
    linkedProfileUserId: node.linkedProfileUserId,
    status: node.status ?? EntityStatus.ACTIVE,
    additionalInfo: node.additionalInfo,
    positionPermission: positionPermissionToForm(node.positionPermission),
    members: isLeaf ? memberFieldsToForm(node.members, true) : undefined,
  };
}

function PositionPermissionFields({
  namePath,
  groupOptions,
  ancestorOptions,
}: {
  namePath: NamePath;
  groupOptions: Array<{ value: string; label: string }>;
  ancestorOptions: AncestorOption[];
}) {
  const versionName =
    Array.isArray(namePath) ? [...namePath, 'permissionGroupVersionId'] : [namePath, 'permissionGroupVersionId'];
  const includeSelfName =
    Array.isArray(namePath) ? [...namePath, 'includeSelf'] : [namePath, 'includeSelf'];
  const parentScopesName =
    Array.isArray(namePath) ? [...namePath, 'parentScopeKeys'] : [namePath, 'parentScopeKeys'];

  return (
    <Card size="small" title="Phân quyền vị trí" style={{ marginBottom: 12 }}>
      <Form.Item name={versionName} label="Nhóm quyền">
        <Select
          allowClear
          placeholder="Chọn nhóm quyền"
          options={groupOptions}
        />
      </Form.Item>
      <Form.Item name={includeSelfName} valuePropName="checked" initialValue={true}>
        <Checkbox>Chỉ cá nhân</Checkbox>
      </Form.Item>
      {ancestorOptions.length > 0 && (
        <Form.Item name={parentScopesName} label="Phạm vi cấp trên">
          <Checkbox.Group
            style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
            options={ancestorOptions.map((a) => ({
              value: `${a.type}:${a.id}`,
              label: `${scopeTypeLabel(a.type)}: ${a.name}`,
            }))}
          />
        </Form.Item>
      )}
    </Card>
  );
}

function MembersFormList({
  withLinkedProfile,
  withPositionPermission,
  users,
  groupOptions,
  ancestorOptions,
}: {
  withLinkedProfile?: boolean;
  withPositionPermission?: boolean;
  users: UserOption[];
  groupOptions?: Array<{ value: string; label: string }>;
  ancestorOptions?: AncestorOption[];
}) {
  return (
    <Form.List name="members">
      {(fields, { add, remove }) => (
        <>
          <Typography.Text strong>Danh sách thành viên</Typography.Text>
          {fields.map(({ key, name, ...restField }) => (
            <Card key={key} size="small" style={{ marginTop: 8 }}>
              <Form.Item {...restField} name={[name, 'id']} hidden>
                <Input />
              </Form.Item>
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
                      <LinkedProfileSelect
                        users={users}
                        nameField={['members', name, 'memberName']}
                        phoneField={['members', name, 'phone']}
                        emailField={['members', name, 'email']}
                      />
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
                {withPositionPermission && groupOptions && (
                  <Col span={24}>
                    <PositionPermissionFields
                      namePath={[name, 'positionPermission']}
                      groupOptions={groupOptions}
                      ancestorOptions={ancestorOptions ?? []}
                    />
                  </Col>
                )}
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
            <Descriptions.Item label="Phân quyền vị trí">
              {formatPositionPermissionSummary(m.positionPermission)}
            </Descriptions.Item>
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
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroupOption[]>([]);
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
      params: { pageSize: 100 },
    });
    setUsers(data.items);
  }, []);

  const loadPermissionGroups = useCallback(async () => {
    const { data } = await api.get<PermissionGroupOption[]>('/permission-groups');
    setPermissionGroups(data);
  }, []);

  useEffect(() => {
    loadTree();
    loadUsers();
    loadPermissionGroups();
  }, [loadTree, loadUsers, loadPermissionGroups]);

  useEffect(() => {
    setIsEditing(false);
    if (!selected || selected.member) {
      form.resetFields();
      return;
    }
    form.setFieldsValue(nodeToFormValues(selected.data));
  }, [selected, form]);

  const permissionGroupOptions = useMemo(
    () =>
      permissionGroups.flatMap((g) => {
        const defaultVersion = g.versions.find((v) => !v.isCustom);
        return defaultVersion ? [{ value: defaultVersion.id, label: g.name }] : [];
      }),
    [permissionGroups],
  );

  const selectedAncestorOptions = useMemo(() => {
    if (!treeData || !selected) return [];
    return getAncestorOptions(treeData, nodeKey(selected));
  }, [treeData, selected]);

  const canUpdateSelected =
    !!selected &&
    !selected.member &&
    ((selected.type === OrgNodeType.ORGANIZATION &&
      hasPermission(Permissions.ORGANIZATION_MANAGE)) ||
      (selected.type === OrgNodeType.COMPANY && hasPermission(Permissions.COMPANY_UPDATE)) ||
      (selected.type === OrgNodeType.UNIT && hasPermission(Permissions.ORG_UNIT_UPDATE)));

  const linkedUserLabel = (userId?: string | null, fallbackName?: string | null) => {
    if (userId) {
      const user = users.find((u) => u.id === userId);
      if (user) {
        return `${user.fullName} (${user.accountCode})`;
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
    !selected.member &&
    (selected.type === OrgNodeType.COMPANY || selected.type === OrgNodeType.UNIT) &&
    hasPermission(Permissions.ORG_UNIT_MOVE);

  const isLeafUnit =
    selected?.type === OrgNodeType.UNIT &&
    !selected.member &&
    (selected.data.isLeaf ?? selected.data.childCount === 0);

  const canDeleteUnit =
    selected?.type === OrgNodeType.UNIT &&
    !selected.member &&
    (selected.data.isLeaf ?? selected.data.childCount === 0) &&
    (selected.data.members?.length ?? 0) === 0;

  const canShowAddUnit =
    !!selected &&
    !selected.member &&
    !isEditing &&
    hasPermission(Permissions.ORG_UNIT_CREATE) &&
    (selected.type === OrgNodeType.COMPANY ||
      (selected.type === OrgNodeType.UNIT && (selected.data.members?.length ?? 0) === 0));

  const renderReorderButtons = () => {
    if (!canReorderSelected || isEditing || !siblingInfo) return null;
    const canMoveUp = siblingInfo.index > 0;
    const canMoveDown = siblingInfo.index < siblingInfo.total - 1;
    return (
      <Space size={4}>
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
    );
  };

  const renderPanelExtra = () => {
    if (!selected || selected.member) return null;

    return (
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
          <Button size="small" icon={<EditOutlined />} title="Sửa" onClick={() => setIsEditing(true)} />
        )}
        {selected.type === OrgNodeType.COMPANY && hasPermission(Permissions.COMPANY_DELETE) && (
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            title="Xóa"
            onClick={handleDelete}
          />
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
            />
          )}
      </Space>
    );
  };

  const handleSelect = (_keys: React.Key[], info: { node: DataNode }) => {
    const key = String(info.node.key);
    if (!treeData) return;

    if (key.startsWith(UNIT_MEMBER_KEY_PREFIX)) {
      const memberId = key.slice(UNIT_MEMBER_KEY_PREFIX.length);
      const found = findUnitMemberInTree(treeData, memberId);
      if (!found) return;
      setIsEditing(false);
      setSelected({
        type: OrgNodeType.UNIT,
        id: found.unit.id,
        data: found.unit,
        member: found.member,
      });
      return;
    }

    const [type, id] = key.split(':');
    const data = findNodeInTree(treeData, key);
    if (!data) return;
    setIsEditing(false);
    setSelected({ type: type as OrgNodeType, id, data });
  };

  const refreshSelection = async (type: OrgNodeType, id: string, memberId?: string) => {
    const tree = await loadTree(search || undefined);
    if (!tree) return;
    const updated = findNodeInTree(tree, nodeKey({ type, id }));
    if (!updated) return;
    if (memberId) {
      const member = updated.members?.find((m) => m.id === memberId);
      setSelected({
        type,
        id,
        data: updated,
        member: member ?? undefined,
      });
      return;
    }
    setSelected({ type, id, data: updated });
  };

  const handleSave = async (values: Record<string, unknown>) => {
    if (!selected) return;
    try {
      const payload: Record<string, unknown> = {
        ...values,
        positionPermission: positionPermissionToPayload(
          values.positionPermission as PositionPermissionFormValue | undefined,
        ),
      };
      if (Array.isArray(values.members) && selected.type === OrgNodeType.UNIT && isLeafUnit) {
        payload.members = (values.members as Array<Record<string, unknown>>).map((m) => ({
          ...m,
          positionPermission: positionPermissionToPayload(
            m.positionPermission as PositionPermissionFormValue | undefined,
          ),
        }));
      } else if (selected.type === OrgNodeType.UNIT && !isLeafUnit) {
        delete payload.members;
      } else if (Array.isArray(values.members)) {
        payload.members = (values.members as Array<Record<string, unknown>>).map((m) => {
          const { positionPermission: _pp, ...rest } = m;
          return rest;
        });
      }
      if (selected.type === OrgNodeType.ORGANIZATION) {
        await api.patch('/organization', payload);
      } else if (selected.type === OrgNodeType.COMPANY) {
        await api.patch(`/organization/companies/${selected.id}`, payload);
      } else {
        await api.patch(`/organization/units/${selected.id}`, payload);
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
    const currentMembers = memberFieldsToForm(selected.data.members, true).map((m) => ({
      ...m,
      positionPermission: positionPermissionToPayload(m.positionPermission),
    }));
    const newMember = {
      ...values,
      positionPermission: positionPermissionToPayload(
        values.positionPermission as PositionPermissionFormValue | undefined,
      ),
    };
    try {
      await api.patch(`/organization/units/${selected.id}`, {
        members: [...currentMembers, newMember],
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
            <LinkedProfileSelect users={users} nameField="representativeName" />
          </Form.Item>
          <PositionPermissionFields
            namePath="positionPermission"
            groupOptions={permissionGroupOptions}
            ancestorOptions={selectedAncestorOptions}
          />
          <Form.Item name="additionalInfo" label="Thông tin thêm">
            <Input.TextArea rows={3} />
          </Form.Item>
          <MembersFormList withLinkedProfile users={users} />
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
            <LinkedProfileSelect
              users={users}
              nameField="representativeName"
              phoneField="phone"
              emailField="email"
            />
          </Form.Item>
          <PositionPermissionFields
            namePath="positionPermission"
            groupOptions={permissionGroupOptions}
            ancestorOptions={selectedAncestorOptions}
          />
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
          <LinkedProfileSelect users={users} nameField="managerName" />
        </Form.Item>
        <PositionPermissionFields
          namePath="positionPermission"
          groupOptions={permissionGroupOptions}
          ancestorOptions={selectedAncestorOptions}
        />
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
        {isLeafUnit && (
          <MembersFormList
            withLinkedProfile
            withPositionPermission
            users={users}
            groupOptions={permissionGroupOptions}
            ancestorOptions={selectedAncestorOptions}
          />
        )}
      </>
    );
  };

  const renderViewPanel = () => {
    if (!selected) return null;

    if (selected.member) {
      const m = selected.member;
      return (
        <div data-testid="unit-member-detail">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Chức vụ">{m.position}</Descriptions.Item>
            <Descriptions.Item label="Tên nhân viên">
              <Typography.Text strong>{m.memberName}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Đơn vị">{selected.data.name}</Descriptions.Item>
            <Descriptions.Item label="Hồ sơ liên kết">
              {linkedUserLabel(m.linkedProfileUserId, m.linkedProfileName)}
            </Descriptions.Item>
            <Descriptions.Item label="Số điện thoại">{displayText(m.phone)}</Descriptions.Item>
            <Descriptions.Item label="Email">{displayText(m.email)}</Descriptions.Item>
            <Descriptions.Item label="Thông tin thêm">{displayText(m.additionalInfo)}</Descriptions.Item>
            <Descriptions.Item label="Phân quyền vị trí">
              {formatPositionPermissionSummary(m.positionPermission)}
            </Descriptions.Item>
          </Descriptions>
        </div>
      );
    }

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
            <Descriptions.Item label="Phân quyền vị trí">
              {formatPositionPermissionSummary(d.positionPermission)}
            </Descriptions.Item>
            <Descriptions.Item label="Thông tin thêm">{displayText(d.additionalInfo)}</Descriptions.Item>
          </Descriptions>
          <Typography.Title level={5} style={{ marginTop: 16 }}>
            Danh sách thành viên
          </Typography.Title>
          <MembersViewList members={d.members} withLinkedProfile />
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
            <Descriptions.Item label="Phân quyền vị trí">
              {formatPositionPermissionSummary(d.positionPermission)}
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
          <Descriptions.Item label="Phân quyền vị trí">
            {formatPositionPermissionSummary(d.positionPermission)}
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
    if (selected.member) {
      return (
        <Space size={8} align="center" wrap>
          <UserOutlined />
          <span>Chi tiết chức vụ</span>
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
      <Space size={8} align="center" wrap>
        {icon}
        <span>{selected.type === OrgNodeType.ORGANIZATION ? 'Tổ chức' : 'Chi tiết'}</span>
        {renderReorderButtons()}
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
              onApplied={() => {
                void loadTree(search || undefined);
              }}
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
                  selectedKeys={
                    selected
                      ? [
                          selected.member
                            ? unitMemberKey(selected.member.id)
                            : nodeKey(selected),
                        ]
                      : []
                  }
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
                isEditing && !selected.member ? (
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
            <LinkedProfileSelect
              users={users}
              nameField="memberName"
              phoneField="phone"
              emailField="email"
            />
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
          <PositionPermissionFields
            namePath="positionPermission"
            groupOptions={permissionGroupOptions}
            ancestorOptions={selectedAncestorOptions}
          />
        </Form>
      </Modal>
    </div>
  );
}
