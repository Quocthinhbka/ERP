import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  Button,
  Card,
  Checkbox,
  Descriptions,
  Divider,
  Space,
  Tag,
  Typography,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { api } from '../../lib/api';

interface AccountDetail {
  id: string;
  email: string;
  fullName: string;
  employeeCode: string | null;
  phone: string | null;
  linkedEmployeeProfileId: string | null;
  isActive: boolean;
  roles: Array<{ id: string; code: string; name: string }>;
}

interface PermissionItem {
  id: string;
  code: string;
  name: string;
  module: string;
}

interface OrgScopeItem {
  type: string;
  id: string;
}

interface EffectivePermissions {
  isSystemAdmin: boolean;
  effectivePermissionCodes: string[];
  orgScopes: OrgScopeItem[];
  note: string;
  permissions: Record<string, PermissionItem[]>;
}

const MODULE_LABELS: Record<string, string> = {
  setup: 'Thiết lập',
  user: 'Tài khoản',
  role: 'Vai trò',
  permission_group: 'Nhóm quyền',
  organization: 'Tổ chức',
};

const SCOPE_TYPE_LABELS: Record<string, string> = {
  organization: 'Tổ chức',
  company: 'Công ty',
  unit: 'Đơn vị',
};

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [permData, setPermData] = useState<EffectivePermissions | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [accountRes, permRes] = await Promise.all([
        api.get<AccountDetail>(`/users/${id}`),
        api.get<EffectivePermissions>(`/users/${id}/permissions`).catch(() => ({ data: null })),
      ]);
      setAccount(accountRes.data);
      setPermData(permRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  if (loading || !account) {
    return null;
  }

  const effectiveCodes = new Set(permData?.effectivePermissionCodes ?? []);

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/setup/accounts')}>
        Quay lại
      </Button>

      <Card title="Thông tin tài khoản">
        <Descriptions column={2}>
          <Descriptions.Item label="Mã NV">{account.employeeCode ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="SĐT">{account.phone ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Email">{account.email}</Descriptions.Item>
          <Descriptions.Item label="Họ tên">{account.fullName}</Descriptions.Item>
          <Descriptions.Item label="Hồ sơ liên kết">
            {account.linkedEmployeeProfileId ? (
              <Tag color="green">Đã liên kết (HR)</Tag>
            ) : (
              <Tag>Chưa có — module HR sẽ bổ sung</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Vai trò">
            {account.roles.map((r) => (
              <Tag key={r.id}>{r.name}</Tag>
            ))}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            {account.isActive ? <Tag color="green">Hoạt động</Tag> : <Tag color="red">Khóa</Tag>}
          </Descriptions.Item>
          {permData && (
            <Descriptions.Item label="Quản trị hệ thống">
              {permData.isSystemAdmin ? <Tag color="blue">Có</Tag> : <Tag>Không</Tag>}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {permData && (
        <Card title="Quyền hiệu lực (chỉ xem)">
          <Typography.Paragraph type="secondary">{permData.note}</Typography.Paragraph>

          {permData.orgScopes.length > 0 && (
            <>
              <Typography.Text strong>Phạm vi tổ chức</Typography.Text>
              <div style={{ marginTop: 8, marginBottom: 16 }}>
                {permData.orgScopes.map((s) => (
                  <Tag key={`${s.type}:${s.id}`}>
                    {SCOPE_TYPE_LABELS[s.type] ?? s.type}: {s.id.slice(0, 8)}…
                  </Tag>
                ))}
              </div>
            </>
          )}

          {Object.entries(permData.permissions).map(([module, items]) => {
            const effectiveInModule = items.filter((p) => effectiveCodes.has(p.code));
            if (effectiveInModule.length === 0) return null;

            return (
              <div key={module} style={{ marginBottom: 16 }}>
                <Typography.Text strong>
                  {MODULE_LABELS[module] ?? module} ({effectiveInModule.length})
                </Typography.Text>
                <Divider style={{ margin: '8px 0' }} />
                <Space direction="vertical" style={{ paddingLeft: 8 }}>
                  {items.map((p) => {
                    const effective = effectiveCodes.has(p.code);
                    return (
                      <Checkbox key={p.id} checked={effective} disabled>
                        {p.name}
                      </Checkbox>
                    );
                  })}
                </Space>
              </div>
            );
          })}

          {effectiveCodes.size === 0 && !permData.isSystemAdmin && (
            <Typography.Text type="secondary">
              Tài khoản chưa có quyền hiệu lực từ vị trí trên cây tổ chức.
            </Typography.Text>
          )}
        </Card>
      )}

      {!permData && (
        <Card>
          <Typography.Text type="secondary">
            Không tải được quyền hiệu lực của tài khoản.
          </Typography.Text>
        </Card>
      )}
    </Space>
  );
}
