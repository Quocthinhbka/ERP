import { EntityStatus, OrgMember, OrgTreeNode, OrgNodeType, PositionPermissionSummary } from '@erp/shared';
import { NO_ASSIGNEE_LABEL } from './constants';
import { scopeTypeLabel } from './scope-utils';
import type { PositionPermissionFormValue, UserOption } from './types';

export function resolveMemberFields(
  member: Record<string, unknown>,
  users: UserOption[],
): Record<string, unknown> {
  const linkedProfileUserId = member.linkedProfileUserId as string | undefined;
  if (linkedProfileUserId) {
    const user = users.find((u) => u.id === linkedProfileUserId);
    const profile = user?.linkedEmployeeProfile;
    if (profile) {
      return {
        ...member,
        linkedProfileUserId,
        memberName: profile.fullName,
        phone: profile.phone ?? null,
        email: profile.email ?? null,
      };
    }
  }
  return {
    ...member,
    linkedProfileUserId: linkedProfileUserId ?? null,
    memberName: NO_ASSIGNEE_LABEL,
    phone: null,
    email: null,
  };
}

export function positionPermissionToForm(
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

export function positionPermissionToPayload(formValue?: PositionPermissionFormValue | null) {
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

export function formatPositionPermissionSummary(pp?: PositionPermissionSummary | null) {
  if (!pp) return 'Chưa gán';
  const scopes: string[] = [];
  if (pp.includeSelf) scopes.push('Chỉ cá nhân');
  for (const s of pp.parentScopes) {
    scopes.push(scopeTypeLabel(s.type));
  }
  return `${pp.permissionGroupName}${scopes.length ? ` — ${scopes.join(', ')}` : ''}`;
}

export function memberFieldsToForm(members?: OrgMember[], withPositionPermission = false) {
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

export function memberToFormValues(member: OrgMember) {
  return {
    id: member.id,
    position: member.position,
    memberName: member.memberName,
    phone: member.phone ?? undefined,
    email: member.email ?? undefined,
    additionalInfo: member.additionalInfo ?? undefined,
    linkedProfileUserId: member.linkedProfileUserId ?? undefined,
    positionPermission: positionPermissionToForm(member.positionPermission),
  };
}

export function membersPayloadFromForm(
  members: Array<Record<string, unknown>>,
  users: UserOption[],
) {
  return members.map((member) => ({
    ...resolveMemberFields(member, users),
    positionPermission: positionPermissionToPayload(
      member.positionPermission as PositionPermissionFormValue | undefined,
    ),
  }));
}

export function nodeToFormValues(node: OrgTreeNode) {
  if (node.type === OrgNodeType.ORGANIZATION) {
    return {
      name: node.name,
      representativeName: node.representativeName,
      linkedProfileUserId: node.linkedProfileUserId,
      additionalInfo: node.additionalInfo,
      members: memberFieldsToForm(node.members, true),
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
      members: memberFieldsToForm(node.members, true),
      positionPermission: positionPermissionToForm(node.positionPermission),
    };
  }
  return {
    name: node.name,
    managerName: node.managerName,
    linkedProfileUserId: node.linkedProfileUserId,
    status: node.status ?? EntityStatus.ACTIVE,
    additionalInfo: node.additionalInfo,
    positionPermission: positionPermissionToForm(node.positionPermission),
    members: memberFieldsToForm(node.members, true),
  };
}
