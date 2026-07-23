import { Card, Col, Row, Statistic, Tag, Typography } from 'antd';
import { TeamOutlined, KeyOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

function roleLabel(isSystemAdmin?: boolean) {
  if (isSystemAdmin) return 'Quản trị hệ thống';
  return 'Người dùng';
}

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <Typography.Paragraph>
        Xin chào, <strong>{user?.fullName ?? user?.email}</strong>
      </Typography.Paragraph>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Module" value="Thiết lập / Phân quyền" prefix={<SafetyCertificateOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Quyền hạn" value={user?.permissions.length ?? 0} prefix={<KeyOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Vai trò"
              value={roleLabel(user?.isSystemAdmin)}
              prefix={<TeamOutlined />}
            />
            {user?.isSystemAdmin && (
              <Tag color="gold" style={{ marginTop: 8 }}>
                System Admin
              </Tag>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
