import { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Space, Typography, message } from 'antd';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';

interface ChangePasswordValues {
  newPassword: string;
  confirmPassword: string;
}

export function ChangePasswordPage() {
  const { user, loading: authLoading, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    } else if (user && !user.mustChangePassword) {
      navigate('/', { replace: true });
    }
  }, [authLoading, user, navigate]);

  if (authLoading || !user || !user.mustChangePassword) {
    return null;
  }

  const onFinish = async (values: ChangePasswordValues) => {
    setSubmitting(true);
    try {
      await changePassword({ newPassword: values.newPassword });
      message.success('Đổi mật khẩu thành công');
      navigate('/', { replace: true });
    } catch (error: unknown) {
      const serverMessage =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { message?: string | string[] } } })
              .response?.data?.message
          : undefined;
      message.error(
        typeof serverMessage === 'string'
          ? serverMessage
          : Array.isArray(serverMessage)
            ? serverMessage.join(', ')
            : 'Không thể đổi mật khẩu',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1677ff 0%, #001529 100%)',
      }}
    >
      <Card title="Đổi mật khẩu lần đầu" style={{ width: 440 }}>
        <Typography.Paragraph type="secondary">
          Bạn phải đặt mật khẩu mới trước khi sử dụng hệ thống. Không cần nhập
          mật khẩu mặc định hiện tại.
        </Typography.Paragraph>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="newPassword"
            label="Mật khẩu mới"
            rules={[{ required: true, message: 'Nhập mật khẩu mới' }, { min: 8 }]}
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
                  return !value || getFieldValue('newPassword') === value
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error('Mật khẩu xác nhận không khớp'),
                      );
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={submitting}
            >
              Đổi mật khẩu
            </Button>
            <Button
              block
              onClick={async () => {
                await logout();
                navigate('/login', { replace: true });
              }}
            >
              Đăng xuất
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
