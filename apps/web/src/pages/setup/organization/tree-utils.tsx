import { Space, Tag, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  EmployeeWorkPresenceStatus,
  EntityStatus,
  OrgMember,
  OrgNodeType,
  OrgTreeNode,
  WORK_PRESENCE_STATUS_LABELS,
} from '@erp/shared';
import { NO_ASSIGNEE_LABEL, UNIT_MEMBER_KEY_PREFIX } from './constants';
import type { SelectedNode, UserOption } from './types';

export function nodeKey(node: { type: OrgNodeType | string; id: string }) {
  return `${node.type}:${node.id}`;
}

export function unitMemberKey(memberId: string) {
  return `${UNIT_MEMBER_KEY_PREFIX}${memberId}`;
}

export function statusTag(status?: EntityStatus) {
  if (!status) return null;
  return status === EntityStatus.ACTIVE ? (
    <Tag color="green">Hoạt động</Tag>
  ) : (
    <Tag color="red">Ngưng</Tag>
  );
}

function workPresenceTagColor(status: EmployeeWorkPresenceStatus) {
  switch (status) {
    case EmployeeWorkPresenceStatus.WORKING:
      return 'green';
    case EmployeeWorkPresenceStatus.ON_BREAK:
      return 'gold';
    case EmployeeWorkPresenceStatus.ON_LEAVE:
      return 'blue';
    case EmployeeWorkPresenceStatus.ABSENT:
      return 'red';
    default:
      return 'default';
  }
}

export function workPresenceTag(status: EmployeeWorkPresenceStatus) {
  return (
    <Tag color={workPresenceTagColor(status)}>
      {WORK_PRESENCE_STATUS_LABELS[status]}
    </Tag>
  );
}

/** Chỉ hiện thẻ khi vị trí đã gắn hồ sơ nhân viên (có linkedProfileUserId + trạng thái làm việc). */
export function positionWorkPresenceTag(
  linkedProfileUserId?: string | null,
  linkedWorkPresenceStatus?: EmployeeWorkPresenceStatus | null,
) {
  if (!linkedProfileUserId || linkedWorkPresenceStatus == null) return null;
  return workPresenceTag(linkedWorkPresenceStatus);
}

export function findNodeInTree(root: OrgTreeNode, key: string): OrgTreeNode | null {
  if (nodeKey(root) === key) return root;
  for (const child of root.children) {
    const found = findNodeInTree(child, key);
    if (found) return found;
  }
  return null;
}

export function findUnitMemberInTree(
  root: OrgTreeNode,
  memberId: string,
): { unit: OrgTreeNode; member: OrgMember } | null {
  const member = root.members?.find((m) => m.id === memberId);
  if (member) {
    return { unit: root, member };
  }
  for (const child of root.children) {
    const found = findUnitMemberInTree(child, memberId);
    if (found) return found;
  }
  return null;
}

export function displayText(value: string | null | undefined) {
  return value?.trim() ? value : '—';
}

export function displayManagerName(value: string | null | undefined) {
  return value?.trim() ? value : NO_ASSIGNEE_LABEL;
}

function personLabel(node: OrgTreeNode) {
  if (node.type === OrgNodeType.UNIT) {
    return displayManagerName(node.managerName);
  }
  return node.representativeName;
}

export function toTreeData(node: OrgTreeNode, matchedKeys: Set<string>): DataNode {
  const key = nodeKey(node);
  const person = personLabel(node);
  const orgChildren = node.children.map((child) => toTreeData(child, matchedKeys));

  const memberChildren: DataNode[] =
    node.members?.length
      ? node.members.map((m) => ({
          key: unitMemberKey(m.id),
          title: (
            <span>
              <Typography.Text strong style={{ color: 'rgba(0, 0, 0, 0.88)' }}>
                {m.position}
              </Typography.Text>
              <Typography.Text type="secondary"> - </Typography.Text>
              <Typography.Text type="secondary">{displayManagerName(m.memberName)}</Typography.Text>
              {positionWorkPresenceTag(m.linkedProfileUserId, m.linkedWorkPresenceStatus)}
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
        {positionWorkPresenceTag(node.linkedProfileUserId, node.linkedWorkPresenceStatus)}
      </Space>
    ),
    children,
    selectable: true,
    isLeaf: children.length === 0,
  };
}

export function collectAllKeys(node: OrgTreeNode): string[] {
  const keys = [nodeKey(node)];
  for (const child of node.children) {
    keys.push(...collectAllKeys(child));
  }
  return keys;
}

export function findParentNode(root: OrgTreeNode, targetKey: string): OrgTreeNode | null {
  if (nodeKey(root) === targetKey) return null;
  for (const child of root.children) {
    if (nodeKey(child) === targetKey) return root;
    const found = findParentNode(child, targetKey);
    if (found) return found;
  }
  return null;
}

export function getSiblingInfo(tree: OrgTreeNode, selected: SelectedNode) {
  if (selected.member) {
    const members = selected.data.members ?? [];
    const index = members.findIndex((m) => m.id === selected.member!.id);
    if (index === -1) return null;
    return { index, total: members.length };
  }
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

export function userSelectOptions(users: UserOption[]) {
  return users.map((u) => ({
    value: u.id,
    label: `${u.accountCode} — ${u.linkedEmployeeProfile?.fullName ?? u.fullName}`,
  }));
}

export function workPresenceLabel(status?: string | null) {
  if (!status) return '—';
  return (
    WORK_PRESENCE_STATUS_LABELS[status as EmployeeWorkPresenceStatus] ?? status
  );
}
