import { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';

type LoginValues = { identifier: string; password: string };

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  if (user) {
    return null;
  }

  const onFinish = async (values: LoginValues) => {
    setLoading(true);
    try {
      await login({ identifier: values.identifier.trim(), password: values.password });
      message.success('Đăng nhập thành công');
      navigate('/');
    } catch (error: unknown) {
      const status =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { status?: number; data?: { message?: string | string[] } } })
              .response?.status
          : undefined;
      const serverMessage =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { message?: string | string[] } } }).response?.data
              ?.message
          : undefined;
      if (status === 429) {
        message.error('Thử đăng nhập quá nhiều lần. Vui lòng đợi khoảng 1 phút rồi thử lại.');
      } else if (status === 401) {
        message.error('Thông tin đăng nhập hoặc mật khẩu không đúng');
      } else if (typeof serverMessage === 'string') {
        message.error(serverMessage);
      } else if (Array.isArray(serverMessage) && serverMessage[0]) {
        message.error(String(serverMessage[0]));
      } else if (error instanceof Error && error.message) {
        message.error(error.message);
      } else {
        message.error('Không kết nối được máy chủ. Kiểm tra API đang chạy và thử lại.');
      }
    } finally {
      setLoading(false);
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
      <Card style={{ width: 420 }} title="ERP HyperLabs">
        <Typography.Paragraph type="secondary">
          Đăng nhập bằng Mã tài khoản, Số điện thoại hoặc Email
        </Typography.Paragraph>
        <Form layout="vertical" onFinish={onFinish} data-testid="login-form">
          <Form.Item
            label="Mã TK / SĐT / Email"
            name="identifier"
            rules={[{ required: true, message: 'Nhập mã tài khoản, SĐT hoặc email' }]}
          >
            <Input
              placeholder="Mã tài khoản, SĐT hoặc email"
              data-testid="login-identifier"
            />
          </Form.Item>
          <Form.Item
            label="Mật khẩu"
            name="password"
            rules={[{ required: true, message: 'Nhập mật khẩu' }]}
          >
            <Input.Password placeholder="••••••••" data-testid="login-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading} data-testid="login-submit">
            Đăng nhập
          </Button>
        </Form>
      </Card>
    </div>
  );
}
