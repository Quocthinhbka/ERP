import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Space,
  Tag,
  message,
} from 'antd';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

interface PersonalAccount {
  id: string;
  accountCode: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  linkedEmployeeProfileId: string | null;
  isSuperAdmin?: boolean;
}

interface PasswordValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function PersonalAccountPage() {
  const { changePassword } = useAuth();
  const [account, setAccount] = useState<PersonalAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);
  const [form] = Form.useForm<PasswordValues>();

  useEffect(() => {
    api
      .get<PersonalAccount>('/personal/account')
      .then(({ data }) => setAccount(data))
      .finally(() => setLoading(false));
  }, []);

  const submitPassword = async (values: PasswordValues) => {
    setChanging(true);
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      form.resetFields();
      message.success('Đổi mật khẩu thành công');
    } catch (error) {
      const detail = (
        error as { response?: { data?: { message?: string | string[] } } }
      ).response?.data?.message;
      message.error(
        Array.isArray(detail)
          ? detail.join(', ')
          : detail || 'Không thể đổi mật khẩu',
      );
    } finally {
      setChanging(false);
    }
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card title="Thông tin tài khoản" loading={loading}>
        {account ? (
          <Descriptions bordered column={{ xs: 1, md: 2 }}>
            <Descriptions.Item label="Mã tài khoản">
              {account.accountCode}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag color={account.isActive ? 'success' : 'default'}>
                {account.isActive ? 'Đang hoạt động' : 'Đã khóa'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Họ và tên">
              {account.fullName}
            </Descriptions.Item>
            <Descriptions.Item label="Số điện thoại">
              {account.phone ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {account.email ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Loại tài khoản">
              {account.isSuperAdmin ? (
                <Tag color="gold">Super Admin</Tag>
              ) : (
                <Tag>Thường — quyền theo vị trí tổ chức</Tag>
              )}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Card>

      <Card title="Đổi mật khẩu">
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => void submitPassword(values)}
          style={{ maxWidth: 520 }}
        >
          <Form.Item
            name="currentPassword"
            label="Mật khẩu hiện tại"
            rules={[{ required: true, message: 'Nhập mật khẩu hiện tại' }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="Mật khẩu mới"
            rules={[
              { required: true, message: 'Nhập mật khẩu mới' },
              { min: 8, message: 'Mật khẩu phải có ít nhất 8 ký tự' },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Xác nhận mật khẩu mới"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Xác nhận mật khẩu mới' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value || value === getFieldValue('newPassword')
                    ? Promise.resolve()
                    : Promise.reject(new Error('Mật khẩu xác nhận không khớp'));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={changing}>
            Đổi mật khẩu
          </Button>
        </Form>
      </Card>
    </Space>
  );
}
