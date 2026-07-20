import { useEffect, useState } from 'react';
import { Card, Collapse, Table, Tag } from 'antd';
import { api } from '../../lib/api';

interface PermissionItem {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string | null;
}

export function PermissionsPage() {
  const [grouped, setGrouped] = useState<Record<string, PermissionItem[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get<{ grouped: Record<string, PermissionItem[]> }>(
          '/permissions',
        );
        setGrouped(data.grouped);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const items = Object.entries(grouped).map(([module, permissions]) => ({
    key: module,
    label: (
      <span>
        Module: <Tag color="blue">{module}</Tag> ({permissions.length} quyền)
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
    <Card title="Danh sách quyền hạn" loading={loading}>
      <Collapse items={items} />
    </Card>
  );
}
