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
    } catch {
      message.error('Thông tin đăng nhập hoặc mật khẩu không đúng');
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
          Đăng nhập bằng Mã nhân viên, Số điện thoại hoặc Email
        </Typography.Paragraph>
        <Form layout="vertical" onFinish={onFinish} data-testid="login-form">
          <Form.Item
            label="Mã NV / SĐT / Email"
            name="identifier"
            rules={[{ required: true, message: 'Nhập mã nhân viên, SĐT hoặc email' }]}
          >
            <Input
              placeholder="NV001, 0900000001 hoặc admin@hyperlabs.vn"
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
