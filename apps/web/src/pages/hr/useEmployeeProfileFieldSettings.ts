import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  EmployeeProfileFieldDataType,
  ProfileFieldOptions,
} from '@erp/shared';
import { message } from 'antd';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/errors';
import { queryKeys } from '../../lib/queryKeys';

export type ProfileLayoutField = {
  id: string;
  code: string;
  label: string;
  dataType: EmployeeProfileFieldDataType;
  options: ProfileFieldOptions | null;
  required: boolean;
  visible: boolean;
  locked: boolean;
  isSystem: boolean;
  storageKey: string | null;
  sortOrder: number;
  tabIds: string[];
};

export type ProfileLayoutTab = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isSystem: boolean;
  visible: boolean;
  fields: ProfileLayoutField[];
};

export type ProfileLayout = {
  tabs: ProfileLayoutTab[];
  fields: ProfileLayoutField[];
};

const EMPTY_LAYOUT: ProfileLayout = { tabs: [], fields: [] };

async function fetchProfileLayout(): Promise<ProfileLayout> {
  const { data } = await api.get<ProfileLayout>('/employee-profile-settings');
  return data;
}

export function useEmployeeProfileLayout() {
  const queryClient = useQueryClient();

  const { data: layout = EMPTY_LAYOUT, isLoading: loading, refetch } = useQuery({
    queryKey: queryKeys.employeeProfileLayout,
    queryFn: fetchProfileLayout,
  });

  const setLayout = useCallback(
    (next: ProfileLayout) => {
      queryClient.setQueryData(queryKeys.employeeProfileLayout, next);
    },
    [queryClient],
  );

  const reload = useCallback(async () => {
    const result = await refetch();
    if (result.isError) {
      message.error(getApiErrorMessage(result.error, 'Không tải được cấu hình trường hồ sơ'));
    }
  }, [refetch]);

  const byCode = useMemo(() => {
    const map = new Map<string, ProfileLayoutField>();
    for (const item of layout.fields) map.set(item.code, item);
    return map;
  }, [layout.fields]);

  const isVisible = useCallback(
    (fieldKey: string) => byCode.get(fieldKey)?.visible !== false,
    [byCode],
  );

  const isRequired = useCallback(
    (fieldKey: string) =>
      byCode.get(fieldKey)?.visible === true && byCode.get(fieldKey)?.required === true,
    [byCode],
  );

  const visibleTabs = useMemo(
    () => layout.tabs.filter((t) => t.visible),
    [layout.tabs],
  );

  return {
    layout,
    setLayout,
    loading,
    reload,
    byCode,
    isVisible,
    isRequired,
    visibleTabs,
  };
}

/** Alias tương thích tên hook cũ. */
export function useEmployeeProfileFieldSettings() {
  return useEmployeeProfileLayout();
}

export type ProfileFieldSetting = {
  fieldKey: string;
  label: string;
  visible: boolean;
  required: boolean;
  sortOrder: number;
  locked: boolean;
  kind: 'scalar' | 'section';
};
