import { useEffect } from 'react';
import { Card, Collapse, Table, message } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/errors';
import { queryKeys } from '../../lib/queryKeys';

interface PermissionItem {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string | null;
}

async function fetchPermissions() {
  const { data } = await api.get<{ grouped: Record<string, PermissionItem[]> }>('/permissions');
  return data.grouped;
}

export function PermissionsPage() {
  const { data: grouped = {}, isLoading: loading, isError, error } = useQuery({
    queryKey: queryKeys.permissionsGrouped,
    queryFn: fetchPermissions,
  });

  useEffect(() => {
    if (isError) {
      message.error(getApiErrorMessage(error, 'Không tải được danh sách quyền'));
    }
  }, [isError, error]);

  const items = Object.entries(grouped).map(([module, permissions]) => ({
    key: module,
    label: (
      <span>
        Module: <strong>{module}</strong> ({permissions.length} quyền)
      </span>
    ),
    children: (
      <Table
        rowKey="id"
        pagination={false}
        dataSource={permissions}
        columns={[
          { title: 'Mã', dataIndex: 'code' },
          { title: 'Tên', dataIndex: 'name' },
          { title: 'Mô tả', dataIndex: 'description' },
        ]}
      />
    ),
  }));

  return (
    <Card title="Danh sách quyền hạn" loading={loading} data-testid="permissions-page">
      <Collapse items={items} />
    </Card>
  );
}
