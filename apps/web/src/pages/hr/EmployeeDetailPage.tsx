import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Empty,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router';
import { Permissions } from '@erp/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  EDUCATION_LEVEL_OPTIONS,
  FAMILY_RELATIONSHIP_OPTIONS,
  GENDER_OPTIONS,
  RELIGION_OPTIONS,
  TRAINING_MODE_OPTIONS,
} from './employee-catalogs';
import { EMPLOYEE_FIELDS, SECTION_TITLES } from './employee-fields';
import type { EmployeeProfileDetail } from './employee-types';

const text = (value?: string | null) => value?.trim() || '—';
const date = (value?: string | null) => value ? new Intl.DateTimeFormat('vi-VN').format(new Date(`${value.slice(0, 10)}T00:00:00Z`)) : '—';
const month = (value?: string | null) => {
  if (!value) return 'Hiện tại';
  const [year, mm] = value.slice(0, 7).split('-');
  return `${mm}/${year}`;
};

const genderLabel = (value?: string) => GENDER_OPTIONS.find((item) => item.value === value)?.label ?? '—';
const religionLabel = (value?: string | null) => RELIGION_OPTIONS.find((item) => item.value === value)?.label ?? '—';
const educationLevelLabel = (value?: string) => EDUCATION_LEVEL_OPTIONS.find((item) => item.value === value)?.label ?? '—';
const relationshipLabel = (value: string) => FAMILY_RELATIONSHIP_OPTIONS.find((item) => item.value === value)?.label ?? value;
const trainingModeLabel = (value: string) => TRAINING_MODE_OPTIONS.find((item) => item.value === value)?.label ?? value;

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [profile, setProfile] = useState<EmployeeProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get<EmployeeProfileDetail>(`/employees/${id}`);
        setProfile(data);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  if (loading || !profile) {
    return <Card loading />;
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/hr/employees')}>Quay lại</Button>
          {hasPermission(Permissions.HR_EMPLOYEE_UPDATE) ? (
            <Link to={`/hr/employees/${profile.id}/edit`}>
              <Button type="primary" icon={<EditOutlined />}>Chỉnh sửa</Button>
            </Link>
          ) : null}
        </Space>
        <Typography.Title level={4} style={{ margin: 0 }}>{profile.profileCode} · {profile.fullName}</Typography.Title>
      </Space>

      <Card title={SECTION_TITLES.personal}>
        <Descriptions bordered column={2} size="middle">
          <Descriptions.Item label="Mã hồ sơ">{profile.profileCode}</Descriptions.Item>
          <Descriptions.Item label={EMPLOYEE_FIELDS.status.label}>{profile.status === 'ACTIVE' ? <Tag color="green">Đang hoạt động</Tag> : <Tag color="red">Đã khóa</Tag>}</Descriptions.Item>
          <Descriptions.Item label={EMPLOYEE_FIELDS.fullName.label}>{profile.fullName}</Descriptions.Item>
          <Descriptions.Item label={EMPLOYEE_FIELDS.gender.label}>{genderLabel(profile.gender)}</Descriptions.Item>
          <Descriptions.Item label={EMPLOYEE_FIELDS.birthDate.label}>{date(profile.birthDate)}</Descriptions.Item>
          <Descriptions.Item label={EMPLOYEE_FIELDS.birthPlace.label}>{profile.birthPlace}</Descriptions.Item>
          <Descriptions.Item label={EMPLOYEE_FIELDS.placeOfOrigin.label}>{profile.placeOfOrigin}</Descriptions.Item>
          <Descriptions.Item label={EMPLOYEE_FIELDS.phone.label}>{profile.phone}</Descriptions.Item>
          <Descriptions.Item label={EMPLOYEE_FIELDS.email.label}>{profile.email}</Descriptions.Item>
          <Descriptions.Item label={EMPLOYEE_FIELDS.ethnicity.label}>{profile.ethnicity}</Descriptions.Item>
          <Descriptions.Item label={EMPLOYEE_FIELDS.religion.label}>{religionLabel(profile.religion)}</Descriptions.Item>
          <Descriptions.Item label={EMPLOYEE_FIELDS.identityNumber.label}>{profile.identityNumber}</Descriptions.Item>
          <Descriptions.Item label={EMPLOYEE_FIELDS.identityIssuedDate.label}>{date(profile.identityIssuedDate)}</Descriptions.Item>
          <Descriptions.Item label={EMPLOYEE_FIELDS.identityIssuedPlace.label}>{profile.identityIssuedPlace}</Descriptions.Item>
          <Descriptions.Item label={EMPLOYEE_FIELDS.educationLevel.label}>{educationLevelLabel(profile.educationLevel)}</Descriptions.Item>
          <Descriptions.Item label={EMPLOYEE_FIELDS.youthUnionAdmissionDate.label}>{date(profile.youthUnionAdmissionDate)}</Descriptions.Item>
          <Descriptions.Item label={EMPLOYEE_FIELDS.youthUnionAdmissionPlace.label}>{text(profile.youthUnionAdmissionPlace)}</Descriptions.Item>
          <Descriptions.Item label={EMPLOYEE_FIELDS.partyAdmissionDate.label}>{date(profile.partyAdmissionDate)}</Descriptions.Item>
          <Descriptions.Item label={EMPLOYEE_FIELDS.partyAdmissionPlace.label}>{text(profile.partyAdmissionPlace)}</Descriptions.Item>
          <Descriptions.Item span={2} label={EMPLOYEE_FIELDS.permanentAddress.label}>{profile.permanentAddress}</Descriptions.Item>
          <Descriptions.Item span={2} label={EMPLOYEE_FIELDS.currentAddress.label}>{profile.currentAddress}</Descriptions.Item>
          <Descriptions.Item span={2} label={EMPLOYEE_FIELDS.rewardDiscipline.label}>{text(profile.rewardDiscipline)}</Descriptions.Item>
          <Descriptions.Item span={2} label={EMPLOYEE_FIELDS.strengths.label}>{text(profile.strengths)}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={SECTION_TITLES.family}>
        {profile.familyMembers.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có người thân" /> : <Table rowKey="id" pagination={profile.familyMembers.length > 10 ? { pageSize: 10 } : false} dataSource={profile.familyMembers} columns={[
          { title: 'STT', render: (_, __, index) => index + 1, width: 70 },
          { title: 'Quan hệ', dataIndex: 'relationship', render: relationshipLabel },
          { title: 'Họ tên', dataIndex: 'fullName' },
          { title: 'Năm sinh', dataIndex: 'birthYear', render: (v) => v ?? '—' },
          { title: 'Nghề nghiệp', dataIndex: 'occupation', render: text },
          { title: 'Cơ quan công tác', dataIndex: 'workplace', render: text },
          { title: 'Chỗ ở hiện nay', dataIndex: 'currentResidence', render: text },
        ]} />}
      </Card>

      <Card title={SECTION_TITLES.education}>
        {profile.educationHistories.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có quá trình đào tạo" /> : <Table rowKey="id" pagination={profile.educationHistories.length > 10 ? { pageSize: 10 } : false} dataSource={profile.educationHistories} columns={[
          { title: 'STT', render: (_, __, index) => index + 1, width: 70 },
          { title: 'Từ tháng', dataIndex: 'fromMonth', render: month },
          { title: 'Đến tháng', dataIndex: 'toMonth', render: month },
          { title: 'Trường/Cơ sở đào tạo', dataIndex: 'institution' },
          { title: 'Ngành học', dataIndex: 'major' },
          { title: 'Hình thức đào tạo', dataIndex: 'trainingMode', render: trainingModeLabel },
          { title: 'Văn bằng', dataIndex: 'degree' },
        ]} />}
      </Card>

      <Card title={SECTION_TITLES.work}>
        {profile.workHistories.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có quá trình công tác" /> : <Table rowKey="id" pagination={profile.workHistories.length > 10 ? { pageSize: 10 } : false} dataSource={profile.workHistories} columns={[
          { title: 'STT', render: (_, __, index) => index + 1, width: 70 },
          { title: 'Từ tháng', dataIndex: 'fromMonth', render: month },
          { title: 'Đến tháng', dataIndex: 'toMonth', render: month },
          { title: 'Công ty/Cơ quan', dataIndex: 'company' },
          { title: 'Đơn vị công tác', dataIndex: 'department', render: text },
          { title: 'Chức vụ', dataIndex: 'position' },
        ]} />}
      </Card>
    </Space>
  );
}
