import { useEffect, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { ArrowLeftOutlined, EditOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EmployeeProfileEditRequestStatus,
  EmployeeProfileStatus,
  Permissions,
} from '@erp/shared';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/errors';
import { queryKeys } from '../../lib/queryKeys';
import { useAuth } from '../../contexts/AuthContext';
import {
  FAMILY_RELATIONSHIP_OPTIONS,
  TRAINING_MODE_OPTIONS,
} from './employee-catalogs';
import { SECTION_TITLES } from './employee-fields';
import { resolveAvatarSrc } from './EmployeeAvatarField';
import { EmployeeDocumentsSection } from './EmployeeDocumentsSection';
import { DynamicProfileDetailTabs } from './DynamicProfileDetailTabs';
import { useEmployeeProfileLayout } from './useEmployeeProfileFieldSettings';
import type { EmployeeProfileDetail } from './employee-types';

const text = (value?: string | null) => value?.trim() || '—';
const month = (value?: string | null) => {
  if (!value) return 'Hiện tại';
  const [year, mm] = value.slice(0, 7).split('-');
  return `${mm}/${year}`;
};

const relationshipLabel = (value: string) =>
  FAMILY_RELATIONSHIP_OPTIONS.find((item) => item.value === value)?.label ?? value;
const trainingModeLabel = (value: string) =>
  TRAINING_MODE_OPTIONS.find((item) => item.value === value)?.label ?? value;

export type EmployeePageMode = 'personal' | 'hr';

export function EmployeeDetailPage({ mode }: { mode: EmployeePageMode }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const personalMode = mode === 'personal';
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [requesting, setRequesting] = useState(false);
  const { isVisible, visibleTabs } = useEmployeeProfileLayout();

  const {
    data: profile,
    isLoading: loading,
    isError,
    error,
  } = useQuery({
    queryKey: personalMode ? queryKeys.personalProfile : queryKeys.employee(id ?? ''),
    queryFn: async () => {
      const { data } = await api.get<EmployeeProfileDetail>(
        personalMode ? '/personal/profile' : `/employees/${id}`,
      );
      return data;
    },
    enabled: personalMode || Boolean(id),
    retry: false,
  });

  const profileUnavailable = isError;

  useEffect(() => {
    if (isError) {
      message.error(
        getApiErrorMessage(
          error,
          personalMode ? 'Không tải được hồ sơ cá nhân' : 'Không tải được hồ sơ nhân sự',
        ),
      );
    }
  }, [isError, error, personalMode]);

  if (loading) {
    return <Card loading />;
  }
  if (!profile) {
    return (
      <Card title="Hồ sơ cá nhân">
        <Empty
          description={
            profileUnavailable
              ? personalMode
                ? 'Tài khoản chưa liên kết hồ sơ nhân sự'
                : 'Không tải được hồ sơ nhân sự'
              : 'Không tìm thấy hồ sơ'
          }
        />
      </Card>
    );
  }

  const selfEditable =
    profile.status === EmployeeProfileStatus.INCOMPLETE ||
    profile.status === EmployeeProfileStatus.NEEDS_ADJUSTMENT;
  const pendingRequest =
    profile.latestEditRequest?.status ===
    EmployeeProfileEditRequestStatus.PENDING;
  const pendingHrRequest = profile.editRequests?.find(
    (request) => request.status === EmployeeProfileEditRequestStatus.PENDING,
  );

  const submitEditRequest = async () => {
    if (!requestReason.trim()) {
      message.warning('Vui lòng nhập lý do yêu cầu chỉnh sửa');
      return;
    }
    setRequesting(true);
    try {
      await api.post('/personal/profile/edit-requests', {
        reason: requestReason.trim(),
      });
      message.success('Đã gửi yêu cầu chỉnh sửa đến HR');
      setRequestOpen(false);
      setRequestReason('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.personalProfile });
    } finally {
      setRequesting(false);
    }
  };

  const reviewHrRequest = (decision: 'approve' | 'reject') => {
    if (!pendingHrRequest || !id) return;
    Modal.confirm({
      title: decision === 'approve' ? 'Duyệt yêu cầu chỉnh sửa?' : 'Từ chối yêu cầu?',
      content: pendingHrRequest.reason || 'Không có lý do',
      okText: decision === 'approve' ? 'Duyệt' : 'Từ chối',
      okButtonProps: decision === 'reject' ? { danger: true } : undefined,
      onOk: async () => {
        await api.post(
          `/employees/edit-requests/${pendingHrRequest.id}/${decision}`,
          {},
        );
        message.success('Đã xử lý yêu cầu chỉnh sửa');
        void queryClient.invalidateQueries({ queryKey: queryKeys.employee(id) });
      },
    });
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(personalMode ? '/' : '/hr/employees')}
          >
            Quay lại
          </Button>
          {(personalMode && selfEditable) ||
          (!personalMode &&
            (hasPermission(Permissions.HR_EMPLOYEE_UPDATE) ||
              hasPermission(Permissions.HR_EMPLOYEE_STATUS_UPDATE) ||
              hasPermission(Permissions.HR_EMPLOYEE_VERIFY))) ? (
            <Link
              to={
                personalMode
                  ? '/personal/profile/edit'
                  : `/hr/employees/${profile.id}/edit`
              }
            >
              <Button type="primary" icon={<EditOutlined />}>
                {!personalMode &&
                profile.status === EmployeeProfileStatus.LOCKED &&
                !hasPermission(Permissions.HR_EMPLOYEE_UPDATE)
                  ? 'Đổi trạng thái'
                  : 'Chỉnh sửa'}
              </Button>
            </Link>
          ) : null}
          {personalMode && !selfEditable && !pendingRequest ? (
            <Button onClick={() => setRequestOpen(true)}>Yêu cầu sửa</Button>
          ) : null}
          {personalMode && pendingRequest ? (
            <Tag color="processing">Yêu cầu sửa đang chờ HR xử lý</Tag>
          ) : null}
        </Space>
        <Space>
          <Avatar size={56} src={resolveAvatarSrc(profile.avatarUrl)} icon={<UserOutlined />} />
          <Typography.Title level={4} style={{ margin: 0 }}>{profile.profileCode} · {profile.fullName}</Typography.Title>
        </Space>
      </Space>

      {!personalMode && pendingHrRequest ? (
        <Card title="Yêu cầu chỉnh sửa" size="small">
          <Space direction="vertical">
            <Typography.Text>{pendingHrRequest.reason || 'Không có lý do'}</Typography.Text>
            {hasPermission(Permissions.HR_EMPLOYEE_EDIT_REQUEST_REVIEW) ? (
              <Space>
                <Button type="primary" onClick={() => reviewHrRequest('approve')}>
                  Duyệt và mở chỉnh sửa
                </Button>
                <Button onClick={() => reviewHrRequest('reject')}>Từ chối</Button>
              </Space>
            ) : null}
          </Space>
        </Card>
      ) : null}

      <Card title="Thông tin hồ sơ">
        <div style={{ marginBottom: 16 }}>
          <Avatar size={96} src={resolveAvatarSrc(profile.avatarUrl)} icon={<UserOutlined />} />
        </div>
        <DynamicProfileDetailTabs profile={profile} tabs={visibleTabs} />
      </Card>

      {isVisible('section.family') ? (
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
      ) : null}

      {isVisible('section.education') ? (
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
      ) : null}

      {isVisible('section.work') ? (
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
      ) : null}

      <EmployeeDocumentsSection
        endpoint={
          personalMode ? '/personal/profile' : `/employees/${profile.id}`
        }
        canEdit={false}
      />

      <Modal
        title="Yêu cầu chỉnh sửa hồ sơ"
        open={requestOpen}
        okText="Gửi yêu cầu"
        cancelText="Hủy"
        confirmLoading={requesting}
        onOk={() => void submitEditRequest()}
        onCancel={() => setRequestOpen(false)}
      >
        <Input.TextArea
          rows={4}
          value={requestReason}
          maxLength={1000}
          showCount
          placeholder="Nêu rõ nội dung cần chỉnh sửa"
          onChange={(event) => setRequestReason(event.target.value)}
        />
      </Modal>
    </Space>
  );
}
