import { useMemo, useState, type ReactNode } from 'react';
import { Layout, Menu, Tooltip, Typography, Button, theme } from 'antd';
import type { MenuProps } from 'antd';
import {
  ApartmentOutlined,
  DashboardOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  KeyOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { Permissions } from '@erp/shared';
import { useAuth } from '../contexts/AuthContext';

const { Header, Sider, Content } = Layout;

const SIDER_WIDTH = 240;
const SIDER_COLLAPSED_WIDTH = 72;
const HEADER_HEIGHT = 48;
const TREE_STEP = 12;
const TREE_LINE_WIDTH = 1;
const ROW_HEIGHT = 34;

type NavNode = {
  key: string;
  icon: ReactNode;
  label: string;
  path?: string;
  children?: NavNode[];
};

type CollapsedRow = {
  node: NavNode;
  depth: number;
  isLast: boolean;
  ancestorIsLast: boolean[];
  pathLabels: string[];
};

function flattenCollapsedRows(
  nodes: NavNode[],
  pathLabels: string[] = [],
  ancestorIsLast: boolean[] = [],
): CollapsedRow[] {
  return nodes.flatMap((node, index) => {
    const isLast = index === nodes.length - 1;
    const currentPath = [...pathLabels, node.label];
    const row: CollapsedRow = {
      node,
      depth: pathLabels.length,
      isLast,
      ancestorIsLast: [...ancestorIsLast],
      pathLabels: currentPath,
    };

    if (node.children?.length) {
      return [row, ...flattenCollapsedRows(node.children, currentPath, [...ancestorIsLast, isLast])];
    }

    return [row];
  });
}

function pathTooltip(pathLabels: string[]) {
  return pathLabels.join('/');
}

function TreeLines({
  depth,
  isLast,
  ancestorIsLast,
  color,
  lineWidth = TREE_LINE_WIDTH,
}: {
  depth: number;
  isLast: boolean;
  ancestorIsLast: boolean[];
  color: string;
  lineWidth?: number;
}) {
  if (depth === 0) {
    return <div style={{ width: 6, flexShrink: 0 }} />;
  }

  const lineLeft = Math.floor((TREE_STEP - lineWidth) / 2);

  const columns = Array.from({ length: depth }, (_, index) => {
    const isCurrentLevel = index === depth - 1;

    return (
      <div
        key={index}
        style={{
          width: TREE_STEP,
          height: ROW_HEIGHT,
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {!isCurrentLevel && !ancestorIsLast[index] && (
          <span
            style={{
              position: 'absolute',
              left: lineLeft,
              top: 0,
              bottom: 0,
              width: lineWidth,
              background: color,
            }}
          />
        )}
        {isCurrentLevel && (
          <>
            <span
              style={{
                position: 'absolute',
                left: lineLeft,
                top: 0,
                bottom: isLast ? ROW_HEIGHT / 2 : 0,
                width: lineWidth,
                background: color,
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: lineLeft,
                top: ROW_HEIGHT / 2 - lineWidth / 2,
                width: 8,
                height: lineWidth,
                background: color,
              }}
            />
          </>
        )}
      </div>
    );
  });

  return <div style={{ display: 'flex', flexShrink: 0 }}>{columns}</div>;
}

function flattenNavKeys(nodes: NavNode[]): string[] {
  return nodes.flatMap((node) => {
    if (node.path) return [node.path];
    if (node.children) return flattenNavKeys(node.children);
    return [];
  });
}

function navTreeToMenuItems(nodes: NavNode[]): MenuProps['items'] {
  return nodes.map((node) => {
    if (node.children?.length) {
      return {
        key: node.key,
        icon: node.icon,
        label: node.label,
        children: navTreeToMenuItems(node.children),
      };
    }
    return {
      key: node.path ?? node.key,
      icon: node.icon,
      label: <Link to={node.path!}>{node.label}</Link>,
    };
  });
}

function CollapsedNav({
  nodes,
  selectedKey,
  onNavigate,
}: {
  nodes: NavNode[];
  selectedKey: string;
  onNavigate: (path: string) => void;
}) {
  const { token } = theme.useToken();
  const rows = flattenCollapsedRows(nodes);
  const lineColor = token.colorText;

  return (
    <div style={{ padding: '4px 0' }}>
      {rows.map((row) => {
        const { node, depth, isLast, ancestorIsLast, pathLabels } = row;
        const tooltip = pathTooltip(pathLabels);
        const isGroup = !!node.children?.length;

        return (
          <div
            key={node.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: ROW_HEIGHT,
              marginBottom: 2,
            }}
          >
            <TreeLines
              depth={depth}
              isLast={isLast}
              ancestorIsLast={ancestorIsLast}
              color={lineColor}
            />
            <Tooltip title={tooltip} placement="right">
              {isGroup ? (
                <div
                  style={{
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: token.colorTextSecondary,
                    fontSize: 15,
                    flexShrink: 0,
                  }}
                >
                  {node.icon}
                </div>
              ) : (
                <Button
                  type={selectedKey === node.path ? 'primary' : 'text'}
                  size="small"
                  icon={node.icon}
                  aria-label={tooltip}
                  onClick={() => node.path && onNavigate(node.path)}
                  style={{
                    width: 28,
                    height: 28,
                    minWidth: 28,
                    padding: 0,
                    flexShrink: 0,
                  }}
                />
              )}
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}

function buildNavTree(hasPermission: (p: (typeof Permissions)[keyof typeof Permissions]) => boolean): NavNode[] {
  const setupChildren: NavNode[] = [];

  if (hasPermission(Permissions.ORGANIZATION_VIEW)) {
    setupChildren.push({
      key: 'nav-organization',
      icon: <ApartmentOutlined />,
      label: 'Tổ chức',
      path: '/setup/organization',
    });
  }

  const permissionChildren: NavNode[] = [];
  if (hasPermission(Permissions.ROLE_VIEW)) {
    permissionChildren.push({
      key: 'nav-roles',
      icon: <KeyOutlined />,
      label: 'Vai trò',
      path: '/setup/roles',
    });
  }
  if (hasPermission(Permissions.PERMISSION_GROUP_VIEW)) {
    permissionChildren.push({
      key: 'nav-permission-groups',
      icon: <SafetyCertificateOutlined />,
      label: 'Nhóm quyền',
      path: '/setup/permission-groups',
    });
  }
  if (hasPermission(Permissions.USER_VIEW)) {
    permissionChildren.push({
      key: 'nav-accounts',
      icon: <TeamOutlined />,
      label: 'Tài khoản',
      path: '/setup/accounts',
    });
  }
  if (hasPermission(Permissions.PERMISSION_VIEW)) {
    permissionChildren.push({
      key: 'nav-permissions',
      icon: <SafetyCertificateOutlined />,
      label: 'Quyền hạn',
      path: '/setup/permissions',
    });
  }

  if (permissionChildren.length > 0) {
    setupChildren.push({
      key: 'setup-permissions',
      icon: <KeyOutlined />,
      label: 'Phân quyền',
      children: permissionChildren,
    });
  }

  const items: NavNode[] = [
    {
      key: 'nav-dashboard',
      icon: <DashboardOutlined />,
      label: 'Tổng quan',
      path: '/',
    },
  ];

  if (
    setupChildren.length > 0 &&
    (hasPermission(Permissions.ORGANIZATION_VIEW) || hasPermission(Permissions.SETUP_VIEW))
  ) {
    items.push({
      key: 'setup',
      icon: <SafetyCertificateOutlined />,
      label: 'Thiết lập',
      children: setupChildren,
    });
  }

  return items;
}

export function MainLayout() {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const [collapsed, setCollapsed] = useState(false);

  const navTree = useMemo(() => buildNavTree(hasPermission), [hasPermission]);
  const menuItems = useMemo(() => navTreeToMenuItems(navTree), [navTree]);

  const selectedKey =
    flattenNavKeys(navTree).find((key) => key !== '/' && location.pathname.startsWith(key)) ??
    (location.pathname === '/' ? '/' : location.pathname);

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider
        theme="light"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={SIDER_WIDTH}
        collapsedWidth={SIDER_COLLAPSED_WIDTH}
        trigger={null}
        style={{
          height: '100vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div
          style={{
            height: HEADER_HEIGHT,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? 0 : '0 16px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            overflow: 'hidden',
          }}
        >
          <Typography.Text strong style={{ fontSize: collapsed ? 14 : 16, whiteSpace: 'nowrap' }}>
            {collapsed ? 'HL' : 'ERP HyperLabs'}
          </Typography.Text>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {collapsed ? (
            <div style={{ padding: '4px 2px' }}>
              <CollapsedNav
                nodes={navTree}
                selectedKey={selectedKey}
                onNavigate={(path) => navigate(path)}
              />
            </div>
          ) : (
            <Menu
              mode="inline"
              selectedKeys={[selectedKey]}
              items={menuItems}
              style={{ borderInlineEnd: 0 }}
            />
          )}
        </div>
      </Sider>
      <Layout
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Header
          style={{
            flexShrink: 0,
            background: token.colorBgContainer,
            height: HEADER_HEIGHT,
            lineHeight: `${HEADER_HEIGHT}px`,
            padding: '0 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Button
            type="text"
            aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed((value) => !value)}
          />
          <Typography.Text ellipsis style={{ flex: 1, margin: '0 12px', fontSize: 13 }}>
            {user?.email}
          </Typography.Text>
          <Button
            type="text"
            size="small"
            icon={<LogoutOutlined />}
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Đăng xuất
          </Button>
        </Header>
        <Content
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            margin: 12,
            padding: 12,
            background: token.colorBgContainer,
            borderRadius: token.borderRadiusLG,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
