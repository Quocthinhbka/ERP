import { Layout, Menu, Typography, Button, theme } from 'antd';
import {
  ApartmentOutlined,
  DashboardOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  KeyOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { Permissions } from '@erp/shared';
import { useAuth } from '../contexts/AuthContext';

const { Header, Sider, Content } = Layout;

export function MainLayout() {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = theme.useToken();

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">Tổng quan</Link>,
    },
    ...(hasPermission(Permissions.ORGANIZATION_VIEW) ||
    hasPermission(Permissions.SETUP_VIEW)
      ? [
          {
            key: 'setup',
            icon: <SafetyCertificateOutlined />,
            label: 'Thiết lập',
            children: [
              ...(hasPermission(Permissions.ORGANIZATION_VIEW)
                ? [
                    {
                      key: '/setup/organization',
                      icon: <ApartmentOutlined />,
                      label: <Link to="/setup/organization">Tổ chức</Link>,
                    },
                  ]
                : []),
              ...(hasPermission(Permissions.ROLE_VIEW) ||
              hasPermission(Permissions.USER_VIEW) ||
              hasPermission(Permissions.PERMISSION_VIEW)
                ? [
                    {
                      key: 'setup-permissions',
                      icon: <KeyOutlined />,
                      label: 'Phân quyền',
                      children: [
                        ...(hasPermission(Permissions.ROLE_VIEW)
                          ? [
                              {
                                key: '/setup/roles',
                                icon: <KeyOutlined />,
                                label: <Link to="/setup/roles">Vai trò</Link>,
                              },
                            ]
                          : []),
                        ...(hasPermission(Permissions.USER_VIEW)
                          ? [
                              {
                                key: '/setup/users',
                                icon: <TeamOutlined />,
                                label: <Link to="/setup/users">Người dùng</Link>,
                              },
                            ]
                          : []),
                        ...(hasPermission(Permissions.PERMISSION_VIEW)
                          ? [
                              {
                                key: '/setup/permissions',
                                icon: <SafetyCertificateOutlined />,
                                label: <Link to="/setup/permissions">Quyền hạn</Link>,
                              },
                            ]
                          : []),
                      ],
                    },
                  ]
                : []),
            ],
          },
        ]
      : []),
  ];

  const flattenKeys = (items: typeof menuItems): string[] =>
    items.flatMap((item) => {
      if ('children' in item && item.children) {
        return flattenKeys(item.children as typeof menuItems);
      }
      return [item.key as string];
    });

  const selectedKey =
    flattenKeys(menuItems).find((key) => key !== '/' && location.pathname.startsWith(key)) ??
    (location.pathname === '/' ? '/' : location.pathname);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth={0} theme="light">
        <div style={{ padding: 16, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            ERP HyperLabs
          </Typography.Title>
        </div>
        <Menu mode="inline" selectedKeys={[selectedKey]} items={menuItems} />
      </Sider>
      <Layout>
        <Header
          style={{
            background: token.colorBgContainer,
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Typography.Text>{user?.email}</Typography.Text>
          <Button
            icon={<LogoutOutlined />}
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Đăng xuất
          </Button>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
