import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/errors';
import { queryKeys } from '../../lib/queryKeys';
import type { ProfileLayout } from '../hr/useEmployeeProfileFieldSettings';

function layoutMutationOptions(
  queryClient: ReturnType<typeof useQueryClient>,
  options?: { successMessage?: string; errorMessage?: string },
) {
  return {
    onSuccess: (data: ProfileLayout) => {
      queryClient.setQueryData(queryKeys.employeeProfileLayout, data);
      if (options?.successMessage) {
        message.success(options.successMessage);
      }
    },
    onError: (error: unknown) => {
      message.error(getApiErrorMessage(error, options?.errorMessage ?? 'Thao tác thất bại'));
      void queryClient.invalidateQueries({ queryKey: queryKeys.employeeProfileLayout });
    },
  };
}

export function useEmployeeProfileLayoutMutations() {
  const queryClient = useQueryClient();

  const applyLayout = useCallback(
    (data: ProfileLayout) => {
      queryClient.setQueryData(queryKeys.employeeProfileLayout, data);
    },
    [queryClient],
  );

  const invalidateLayout = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.employeeProfileLayout });
  }, [queryClient]);

  const createTab = useMutation({
    mutationFn: (name: string) =>
      api.post<ProfileLayout>('/employee-profile-settings/tabs', { name }).then((r) => r.data),
    ...layoutMutationOptions(queryClient, { errorMessage: 'Thêm tab thất bại' }),
  });

  const renameTab = useMutation({
    mutationFn: ({ tabId, name }: { tabId: string; name: string }) =>
      api
        .patch<ProfileLayout>(`/employee-profile-settings/tabs/${tabId}`, { name })
        .then((r) => r.data),
    ...layoutMutationOptions(queryClient, {
      successMessage: 'Đã đổi tên tab',
      errorMessage: 'Đổi tên tab thất bại',
    }),
  });

  const reorderTabs = useMutation({
    mutationFn: (tabIds: string[]) =>
      api
        .put<ProfileLayout>('/employee-profile-settings/tabs/reorder', { tabIds })
        .then((r) => r.data),
    ...layoutMutationOptions(queryClient, { errorMessage: 'Đổi thứ tự tab thất bại' }),
  });

  const deleteTab = useMutation({
    mutationFn: (tabId: string) =>
      api.delete<ProfileLayout>(`/employee-profile-settings/tabs/${tabId}`).then((r) => r.data),
    ...layoutMutationOptions(queryClient, {
      successMessage: 'Đã xóa tab',
      errorMessage: 'Xóa tab thất bại',
    }),
  });

  const createField = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<ProfileLayout>('/employee-profile-settings/fields', body).then((r) => r.data),
    ...layoutMutationOptions(queryClient, {
      successMessage: 'Đã thêm trường',
      errorMessage: 'Lưu trường thất bại',
    }),
  });

  const updateField = useMutation({
    mutationFn: ({ fieldId, body }: { fieldId: string; body: Record<string, unknown> }) =>
      api
        .patch<ProfileLayout>(`/employee-profile-settings/fields/${fieldId}`, body)
        .then((r) => r.data),
    ...layoutMutationOptions(queryClient, {
      successMessage: 'Đã cập nhật trường',
      errorMessage: 'Lưu trường thất bại',
    }),
  });

  const deleteField = useMutation({
    mutationFn: (fieldId: string) =>
      api.delete<ProfileLayout>(`/employee-profile-settings/fields/${fieldId}`).then((r) => r.data),
    ...layoutMutationOptions(queryClient, {
      successMessage: 'Đã xóa trường',
      errorMessage: 'Xóa trường thất bại',
    }),
  });

  const detachField = useMutation({
    mutationFn: ({ tabId, fieldId }: { tabId: string; fieldId: string }) =>
      api
        .delete<ProfileLayout>(`/employee-profile-settings/tabs/${tabId}/fields/${fieldId}`)
        .then((r) => r.data),
    ...layoutMutationOptions(queryClient, { errorMessage: 'Thao tác thất bại' }),
  });

  const attachField = useMutation({
    mutationFn: ({ tabId, fieldDefId }: { tabId: string; fieldDefId: string }) =>
      api
        .post<ProfileLayout>(`/employee-profile-settings/tabs/${tabId}/fields`, { fieldDefId })
        .then((r) => r.data),
    ...layoutMutationOptions(queryClient, { errorMessage: 'Thêm vào tab thất bại' }),
  });

  const reorderFields = useMutation({
    mutationFn: ({ tabId, fieldDefIds }: { tabId: string; fieldDefIds: string[] }) =>
      api
        .put<ProfileLayout>(`/employee-profile-settings/tabs/${tabId}/fields/reorder`, {
          fieldDefIds,
        })
        .then((r) => r.data),
    ...layoutMutationOptions(queryClient, { errorMessage: 'Đổi thứ tự trường thất bại' }),
  });

  return {
    applyLayout,
    invalidateLayout,
    createTab,
    renameTab,
    reorderTabs,
    deleteTab,
    createField,
    updateField,
    deleteField,
    detachField,
    attachField,
    reorderFields,
  };
}
