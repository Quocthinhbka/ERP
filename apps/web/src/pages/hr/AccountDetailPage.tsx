import { useEffect } from 'react';
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
  message,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/errors';
import { queryKeys } from '../../lib/queryKeys';
import { PageSpinner } from '../../components/PageSpinner';

interface AccountDetail {
  id: string;
  email: string | null;
  fullName: string;
  accountCode: string;
  phone: string | null;
  linkedEmployeeProfileId: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  isSuperAdmin?: boolean;
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
  hr: 'Nhân sự',
  permission_group: 'Nhóm quyền',
  organization: 'Tổ chức',
};

const SCOPE_TYPE_LABELS: Record<string, string> = {
  organization: 'Tổ chức',
  company: 'Công ty',
  unit: 'Đơn vị',
};

async function fetchAccountDetail(id: string) {
  const [accountRes, permRes] = await Promise.all([
    api.get<AccountDetail>(`/users/${id}`),
    api.get<EffectivePermissions>(`/users/${id}/permissions`).catch(() => ({ data: null })),
  ]);
  return { account: accountRes.data, permData: permRes.data };
}

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: id ? queryKeys.account(id) : ['accounts', 'missing'],
    queryFn: () => fetchAccountDetail(id!),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (isError) {
      message.error(getApiErrorMessage(error, 'Không tải được thông tin tài khoản'));
    }
  }, [isError, error]);

  if (isLoading || !data?.account) {
    return <PageSpinner />;
  }

  const { account, permData } = data;
  const effectiveCodes = new Set(permData?.effectivePermissionCodes ?? []);

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }} data-testid="account-detail-page">
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/hr/accounts')}>
        Quay lại
      </Button>

      <Card title="Thông tin tài khoản">
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Mã tài khoản">{account.accountCode}</Descriptions.Item>
          <Descriptions.Item label="Họ và tên">{account.fullName}</Descriptions.Item>
          <Descriptions.Item label="Email">{account.email ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Số điện thoại">{account.phone ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            {account.isActive ? (
              <Tag color="green">Hoạt động</Tag>
            ) : (
              <Tag color="red">Khóa</Tag>
            )}
          </Descriptions.Item>
          {account.isSuperAdmin && (
            <Descriptions.Item label="Vai trò">
              <Tag color="gold">Super Admin</Tag>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {permData && (
        <Card title="Quyền hiệu lực (chỉ xem)">
          <Typography.Paragraph type="secondary">{permData.note}</Typography.Paragraph>

          {permData.isSystemAdmin && (
            <Typography.Paragraph>
              Tài khoản này nhận toàn bộ quyền hệ thống theo mặc định và không thể chỉnh sửa qua vị trí
              tổ chức.
            </Typography.Paragraph>
          )}

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
                  {items.map((p) => (
                    <Checkbox key={p.id} checked={effectiveCodes.has(p.code)} disabled>
                      {p.name}
                    </Checkbox>
                  ))}
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
