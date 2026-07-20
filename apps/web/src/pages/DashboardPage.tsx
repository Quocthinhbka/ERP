import { Card, Col, Row, Statistic, Typography } from 'antd';
import { TeamOutlined, KeyOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <Typography.Title level={3}>Tổng quan</Typography.Title>
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
            <Statistic title="Vai trò" value="Super Admin" prefix={<TeamOutlined />} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
