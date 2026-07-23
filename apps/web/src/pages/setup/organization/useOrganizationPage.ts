import { useCallback, useEffect, useMemo, useState } from 'react';
import { Form, Grid, message } from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  OrgNodeType,
  OrgTreeNode,
  Permissions,
} from '@erp/shared';
import { api } from '../../../lib/api';
import { getApiErrorMessage } from '../../../lib/errors';
import { useAuth } from '../../../contexts/AuthContext';
import {
  NO_ASSIGNEE_LABEL,
  UNIT_MEMBER_KEY_PREFIX,
  collectAllKeys,
  displayText,
  findNodeInTree,
  findUnitMemberInTree,
  getScopeTreeOptions,
  getSiblingInfo,
  memberFieldsToForm,
  memberToFormValues,
  membersPayloadFromForm,
  nodeKey,
  nodeToFormValues,
  positionPermissionToPayload,
  resolveMemberFields,
  toTreeData,
  type PermissionGroupOption,
  type PositionPermissionFormValue,
  type SelectedNode,
  type TreeResponse,
  type UserOption,
} from './index';

export function useOrganizationPage() {
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
  const [nameModal, setNameModal] = useState<'company' | 'unit' | null>(null);
  const [form] = Form.useForm();
  const [employeeForm] = Form.useForm();
  const [nameForm] = Form.useForm();

  const loadTree = useCallback(
    async (
      keyword?: string,
      options?: { preserveExpanded?: boolean },
    ): Promise<OrgTreeNode | null> => {
      setLoading(true);
      try {
        const { data } = await api.get<TreeResponse>('/organization/tree', {
          params: keyword ? { search: keyword } : undefined,
        });
        setTreeData(data.tree);
        setMatchedKeys(data.matchedKeys);

        if (options?.preserveExpanded) {
          setExpandedKeys((prev) => {
            const validKeys = new Set(collectAllKeys(data.tree));
            const next = prev.filter((k) => validKeys.has(k));
            return next.length > 0 ? next : [nodeKey(data.tree)];
          });
        } else if (data.matchedKeys.length > 0) {
          setExpandedKeys(data.matchedKeys);
        } else if (!keyword) {
          setExpandedKeys([nodeKey(data.tree)]);
        }
        return data.tree;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const loadUsers = useCallback(async () => {
    const { data } = await api.get<{ items: UserOption[] }>('/users', {
      params: { pageSize: 200, hasLinkedProfile: true },
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
    if (!selected) {
      form.resetFields();
      return;
    }
    if (selected.member) {
      form.setFieldsValue(memberToFormValues(selected.member));
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

  const selectedScopeTreeOptions = useMemo(() => {
    if (!treeData || !selected) return [];
    return getScopeTreeOptions(treeData, nodeKey(selected));
  }, [treeData, selected]);

  const canUpdateSelected =
    !!selected &&
    (selected.member
      ? hasPermission(Permissions.ORG_UNIT_UPDATE)
      : ((selected.type === OrgNodeType.ORGANIZATION &&
          hasPermission(Permissions.ORGANIZATION_MANAGE)) ||
        (selected.type === OrgNodeType.COMPANY &&
          hasPermission(Permissions.COMPANY_UPDATE)) ||
        (selected.type === OrgNodeType.UNIT &&
          hasPermission(Permissions.ORG_UNIT_UPDATE))));

  const linkedUserLabel = useCallback(
    (userId?: string | null, fallbackName?: string | null) => {
      if (userId) {
        const user = users.find((u) => u.id === userId);
        if (user) {
          return `${user.fullName} (${user.accountCode})`;
        }
      }
      return displayText(fallbackName);
    },
    [users],
  );

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
    hasPermission(Permissions.ORG_UNIT_MOVE) &&
    (selected.member
      ? true
      : selected.type === OrgNodeType.COMPANY || selected.type === OrgNodeType.UNIT);

  const canDeleteMember =
    !!selected?.member && hasPermission(Permissions.ORG_UNIT_UPDATE);

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

  const refreshSelection = useCallback(
    async (type: OrgNodeType, id: string, memberId?: string) => {
      const tree = await loadTree(search || undefined, { preserveExpanded: true });
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
    },
    [loadTree, search],
  );

  const handleSelect = useCallback(
    (_keys: React.Key[], info: { node: DataNode }) => {
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
    },
    [treeData],
  );

  const handleSave = useCallback(
    async (values: Record<string, unknown>) => {
      if (!selected) return;
      try {
        if (selected.member) {
          const currentMembers = memberFieldsToForm(selected.data.members, true);
          const nextMembers = currentMembers.map((member) =>
            member.id === selected.member!.id
              ? resolveMemberFields(
                  {
                    ...member,
                    ...values,
                    id: selected.member!.id,
                    positionPermission: values.positionPermission,
                  },
                  users,
                )
              : member,
          );
          await api.patch(`/organization/units/${selected.id}`, {
            members: membersPayloadFromForm(nextMembers, users),
          });
          message.success('Lưu thành công');
          setIsEditing(false);
          await refreshSelection(selected.type, selected.id, selected.member.id);
          return;
        }

        const payload: Record<string, unknown> = {
          ...values,
          positionPermission: positionPermissionToPayload(
            values.positionPermission as PositionPermissionFormValue | undefined,
          ),
        };
        if (Array.isArray(values.members)) {
          payload.members = membersPayloadFromForm(
            values.members as Array<Record<string, unknown>>,
            users,
          );
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
      } catch (error) {
        message.error(getApiErrorMessage(error, 'Lưu thất bại'));
      }
    },
    [selected, users, refreshSelection],
  );

  const handleCancelEdit = useCallback(() => {
    if (!selected) return;
    if (selected.member) {
      form.setFieldsValue(memberToFormValues(selected.member));
    } else {
      form.setFieldsValue(nodeToFormValues(selected.data));
    }
    setIsEditing(false);
  }, [selected, form]);

  const handleAddCompany = useCallback(() => {
    nameForm.resetFields();
    setNameModal('company');
  }, [nameForm]);

  const handleAddUnit = useCallback(() => {
    if (!selected || selected.type === OrgNodeType.ORGANIZATION) return;
    nameForm.resetFields();
    setNameModal('unit');
  }, [selected, nameForm]);

  const submitNameModal = useCallback(
    async (values: { name: string }) => {
      const name = values.name.trim();
      if (!name) return;
      try {
        if (nameModal === 'company') {
          await api.post('/organization/companies', { name });
          message.success('Đã thêm công ty');
        } else if (nameModal === 'unit' && selected) {
          const payload =
            selected.type === OrgNodeType.COMPANY
              ? { companyId: selected.id, name }
              : {
                  companyId: selected.data.companyId,
                  parentUnitId: selected.id,
                  name,
                };
          await api.post('/organization/units', payload);
          message.success('Đã thêm đơn vị');
        } else {
          return;
        }
        setNameModal(null);
        nameForm.resetFields();
        await loadTree(search || undefined, { preserveExpanded: true });
      } catch (error) {
        message.error(
          getApiErrorMessage(
            error,
            nameModal === 'company' ? 'Thêm công ty thất bại' : 'Thêm đơn vị thất bại',
          ),
        );
      }
    },
    [nameModal, selected, nameForm, loadTree, search],
  );

  const handleDelete = useCallback(async () => {
    if (!selected || selected.type === OrgNodeType.ORGANIZATION || selected.member) return;
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
      await loadTree(search || undefined, { preserveExpanded: true });
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể xóa'));
    }
  }, [selected, canDeleteUnit, loadTree, search]);

  const handleDeleteMember = useCallback(async () => {
    if (!selected?.member) return;
    try {
      const remaining = memberFieldsToForm(selected.data.members, true).filter(
        (m) => m.id !== selected.member!.id,
      );
      await api.patch(`/organization/units/${selected.id}`, {
        members: membersPayloadFromForm(remaining, users),
      });
      message.success('Đã xóa chức vụ');
      setIsEditing(false);
      await refreshSelection(selected.type, selected.id);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể xóa chức vụ'));
    }
  }, [selected, users, refreshSelection]);

  const handleReorder = useCallback(
    async (direction: 'up' | 'down') => {
      if (!selected) return;
      try {
        if (selected.member) {
          const members = [...(selected.data.members ?? [])];
          const index = members.findIndex((m) => m.id === selected.member!.id);
          const swapWith = direction === 'up' ? index - 1 : index + 1;
          if (index < 0 || swapWith < 0 || swapWith >= members.length) return;
          const reordered = [...members];
          [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];
          await api.patch(`/organization/units/${selected.id}`, {
            members: membersPayloadFromForm(memberFieldsToForm(reordered, true), users),
          });
          message.success('Đã cập nhật thứ tự');
          await refreshSelection(selected.type, selected.id, selected.member.id);
          return;
        }

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
    },
    [selected, users, refreshSelection],
  );

  const handleAddEmployee = useCallback(
    async (values: Record<string, unknown>) => {
      if (!selected || selected.type !== OrgNodeType.UNIT || selected.member) return;
      const currentMembers = membersPayloadFromForm(
        memberFieldsToForm(selected.data.members, true),
        users,
      );
      const newMember = resolveMemberFields(
        {
          ...values,
          positionPermission: positionPermissionToPayload(
            values.positionPermission as PositionPermissionFormValue | undefined,
          ),
        },
        users,
      );
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
    },
    [selected, users, employeeForm, refreshSelection],
  );

  const openEmployeeModal = useCallback(() => {
    employeeForm.resetFields();
    employeeForm.setFieldsValue({ memberName: NO_ASSIGNEE_LABEL });
    setEmployeeModalOpen(true);
  }, [employeeForm]);

  const closeEmployeeModal = useCallback(() => {
    setEmployeeModalOpen(false);
    employeeForm.resetFields();
  }, [employeeForm]);

  const closeNameModal = useCallback(() => {
    setNameModal(null);
    nameForm.resetFields();
  }, [nameForm]);

  const expandAll = useCallback(() => {
    if (treeData) setExpandedKeys(collectAllKeys(treeData));
  }, [treeData]);

  const collapseAll = useCallback(() => {
    setExpandedKeys([]);
  }, []);

  return {
    isDesktopLayout,
    hasPermission,
    treeData,
    loading,
    search,
    setSearch,
    expandedKeys,
    setExpandedKeys,
    selected,
    isEditing,
    setIsEditing,
    employeeModalOpen,
    nameModal,
    form,
    employeeForm,
    nameForm,
    users,
    permissionGroupOptions,
    selectedScopeTreeOptions,
    canUpdateSelected,
    antTreeData,
    siblingInfo,
    canReorderSelected,
    canDeleteMember,
    canDeleteUnit,
    canShowAddUnit,
    linkedUserLabel,
    loadTree,
    handleSelect,
    handleSave,
    handleCancelEdit,
    handleAddCompany,
    handleAddUnit,
    submitNameModal,
    handleDelete,
    handleDeleteMember,
    handleReorder,
    handleAddEmployee,
    openEmployeeModal,
    closeEmployeeModal,
    closeNameModal,
    expandAll,
    collapseAll,
  };
}

export type UseOrganizationPageReturn = ReturnType<typeof useOrganizationPage>;
