import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EmployeeProfileStatus,
  Permissions,
} from '@erp/shared';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/errors';
import { queryKeys } from '../../lib/queryKeys';
import { PageSpinner } from '../../components/PageSpinner';
import { useAuth } from '../../contexts/AuthContext';
import type { EmployeePageMode } from './EmployeeDetailPage';
import {
  FAMILY_RELATIONSHIP_OPTIONS,
  TRAINING_MODE_OPTIONS,
  getNextStatusOptions,
  profileStatusColor,
  profileStatusLabel,
} from './employee-catalogs';
import {
  EDUCATION_FIELDS,
  EMPLOYEE_FIELDS,
  EmployeeFieldSettingsContext,
  FAMILY_MEMBER_FIELDS,
  GuidedFormItem,
  SECTION_TITLES,
  WORK_FIELDS,
  type FieldMeta,
} from './employee-fields';
import { EmployeeAvatarField } from './EmployeeAvatarField';
import { EmployeeDocumentsSection } from './EmployeeDocumentsSection';
import { DynamicProfileFields } from './DynamicProfileFields';
import { useEmployeeProfileLayout } from './useEmployeeProfileFieldSettings';
import { profileToFormValues } from './employee-profile-form';
import type {
  EmployeeCollectionPage,
  EmployeeEducationHistory,
  EmployeeFamilyMember,
  EmployeeProfileDetail,
  EmployeeWorkHistory,
} from './employee-types';

type PersonalFormValues = Record<string, unknown>;
type FamilyFormValues = Record<string, unknown>;
type EducationFormValues = Record<string, unknown>;
type WorkFormValues = Record<string, unknown>;

function monthValue(value?: string | null) {
  return value ? value.slice(0, 7) : undefined;
}

function normalizePayload(values: PersonalFormValues) {
  const next = { ...values };
  for (const key of Object.keys(next)) {
    if (next[key] === '') next[key] = null;
  }
  if (typeof next.fullName === 'string') {
    next.fullName = next.fullName.trim().toLocaleUpperCase('vi-VN');
  }
  if (typeof next.phone === 'string') {
    next.phone = next.phone.replace(/\D/g, '');
  }
  return next;
}

function formatMonth(value?: string | null) {
  if (!value) return '—';
  const [year, month] = value.slice(0, 7).split('-');
  return `${month}/${year}`;
}

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function EmployeeFormPage({ mode }: { mode: EmployeePageMode }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const personalMode = mode === 'personal';
  const profileEndpoint = personalMode
    ? '/personal/profile'
    : id
      ? `/employees/${id}`
      : '';
  const profileQueryKey = personalMode
    ? queryKeys.personalProfile
    : queryKeys.employee(id ?? '');

  const canChangeStatus =
    !personalMode &&
    (hasPermission(Permissions.HR_EMPLOYEE_STATUS_UPDATE) ||
      hasPermission(Permissions.HR_EMPLOYEE_VERIFY));

  const [personalForm] = Form.useForm<PersonalFormValues>();
  const [familyForm] = Form.useForm<FamilyFormValues>();
  const [educationForm] = Form.useForm<EducationFormValues>();
  const [workForm] = Form.useForm<WorkFormValues>();

  const [activeGuide, setActiveGuide] = useState<FieldMeta>(EMPLOYEE_FIELDS.fullName);
  const [familyPageNum, setFamilyPageNum] = useState(1);
  const [familyPageSize, setFamilyPageSize] = useState(10);
  const [educationPageNum, setEducationPageNum] = useState(1);
  const [educationPageSize, setEducationPageSize] = useState(10);
  const [workPageNum, setWorkPageNum] = useState(1);
  const [workPageSize, setWorkPageSize] = useState(10);
  const [familySearch, setFamilySearch] = useState('');
  const [educationSearch, setEducationSearch] = useState('');
  const [workSearch, setWorkSearch] = useState('');
  const [familyEditingId, setFamilyEditingId] = useState<string | null>(null);
  const [educationEditingId, setEducationEditingId] = useState<string | null>(null);
  const [workEditingId, setWorkEditingId] = useState<string | null>(null);
  const [familyModalOpen, setFamilyModalOpen] = useState(false);
  const [educationModalOpen, setEducationModalOpen] = useState(false);
  const [workModalOpen, setWorkModalOpen] = useState(false);
  const { isVisible, isRequired, visibleTabs } = useEmployeeProfileLayout();
  const fieldSettingsCtx = { isVisible, isRequired };
  Form.useWatch([], personalForm);

  const {
    data: profile,
    isLoading: loading,
    isError: profileError,
    error: profileLoadError,
  } = useQuery({
    queryKey: profileQueryKey,
    queryFn: async () => {
      const { data } = await api.get<EmployeeProfileDetail>(profileEndpoint);
      return data;
    },
    enabled: Boolean(profileEndpoint),
  });

  useEffect(() => {
    if (profileError) {
      message.error(getApiErrorMessage(profileLoadError, 'Không tải được hồ sơ nhân viên'));
    }
  }, [profileError, profileLoadError]);

  useEffect(() => {
    if (profile) {
      personalForm.setFieldsValue(profileToFormValues(profile));
    }
  }, [profile, personalForm]);

  const emptyCollection = { items: [], total: 0, page: 1, pageSize: 10 };

  const { data: familyPage = emptyCollection as EmployeeCollectionPage<EmployeeFamilyMember> } =
    useQuery({
      queryKey: queryKeys.employeeFamily(
        profileEndpoint,
        familyPageNum,
        familyPageSize,
        familySearch,
      ),
      queryFn: async () => {
        const { data } = await api.get<EmployeeCollectionPage<EmployeeFamilyMember>>(
          `${profileEndpoint}/family-members`,
          {
            params: {
              page: familyPageNum,
              pageSize: familyPageSize,
              search: familySearch.trim() || undefined,
            },
          },
        );
        return data;
      },
      enabled: Boolean(profileEndpoint),
    });

  const {
    data: educationPage = emptyCollection as EmployeeCollectionPage<EmployeeEducationHistory>,
  } = useQuery({
    queryKey: queryKeys.employeeEducation(
      profileEndpoint,
      educationPageNum,
      educationPageSize,
      educationSearch,
    ),
    queryFn: async () => {
      const { data } = await api.get<EmployeeCollectionPage<EmployeeEducationHistory>>(
        `${profileEndpoint}/education-histories`,
        {
          params: {
            page: educationPageNum,
            pageSize: educationPageSize,
            search: educationSearch.trim() || undefined,
          },
        },
      );
      return data;
    },
    enabled: Boolean(profileEndpoint),
  });

  const { data: workPage = emptyCollection as EmployeeCollectionPage<EmployeeWorkHistory> } =
    useQuery({
      queryKey: queryKeys.employeeWork(
        profileEndpoint,
        workPageNum,
        workPageSize,
        workSearch,
      ),
      queryFn: async () => {
        const { data } = await api.get<EmployeeCollectionPage<EmployeeWorkHistory>>(
          `${profileEndpoint}/work-histories`,
          {
            params: {
              page: workPageNum,
              pageSize: workPageSize,
              search: workSearch.trim() || undefined,
            },
          },
        );
        return data;
      },
      enabled: Boolean(profileEndpoint),
    });

  const invalidateCollections = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['employee-family', profileEndpoint] });
    void queryClient.invalidateQueries({ queryKey: ['employee-education', profileEndpoint] });
    void queryClient.invalidateQueries({ queryKey: ['employee-work', profileEndpoint] });
  }, [queryClient, profileEndpoint]);

  const saveMutation = useMutation({
    mutationFn: (values: PersonalFormValues) =>
      api
        .patch<EmployeeProfileDetail>(profileEndpoint, normalizePayload(values))
        .then((r) => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(profileQueryKey, data);
      personalForm.setFieldsValue(profileToFormValues(data));
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      message.success(
        data.status === EmployeeProfileStatus.PENDING_REVIEW
          ? 'Đã lưu — hồ sơ chuyển Chờ xác nhận'
          : data.status === EmployeeProfileStatus.INCOMPLETE
            ? 'Đã lưu — hồ sơ còn thiếu thông tin bắt buộc'
            : 'Cập nhật sơ yếu lý lịch thành công',
      );
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không lưu được sơ yếu lý lịch')),
  });

  const statusMutation = useMutation({
    mutationFn: (next: EmployeeProfileStatus) =>
      api.patch(`/employees/${id}/status`, { status: next }),
    onSuccess: async (_data, next) => {
      message.success(`Đã chuyển trạng thái: ${profileStatusLabel(next)}`);
      await queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không đổi được trạng thái')),
  });

  const updateProfileAvatar = useCallback(
    (avatarUrl: string | null) => {
      queryClient.setQueryData<EmployeeProfileDetail | undefined>(profileQueryKey, (prev) =>
        prev ? { ...prev, avatarUrl } : prev,
      );
    },
    [queryClient, profileQueryKey],
  );

  const locked =
    profile?.status === EmployeeProfileStatus.LOCKED ||
    profile?.status === EmployeeProfileStatus.EDIT_REQUESTED;
  const canEdit = personalMode
    ? profile?.status === EmployeeProfileStatus.INCOMPLETE ||
      profile?.status === EmployeeProfileStatus.NEEDS_ADJUSTMENT
    : hasPermission(Permissions.HR_EMPLOYEE_UPDATE) &&
      profile?.status !== EmployeeProfileStatus.EDIT_REQUESTED;

  const savePersonal = async (values: PersonalFormValues) => {
    if (!profileEndpoint || locked) {
      message.warning(
        locked
          ? profile?.status === EmployeeProfileStatus.EDIT_REQUESTED
            ? 'Hồ sơ đang chờ duyệt yêu cầu chỉnh sửa'
            : 'Hồ sơ đang khóa'
          : 'Thiếu mã hồ sơ',
      );
      return;
    }
    await saveMutation.mutateAsync(values);
  };

  const changeStatus = async (next: EmployeeProfileStatus) => {
    if (!id || !profile || next === profile.status) return;
    await statusMutation.mutateAsync(next);
  };

  // Route /new đã bỏ — tạo hồ sơ qua dialog trên danh sách.
  if (!id && !personalMode) {
    return <Navigate to="/hr/employees" replace />;
  }

  if (loading && !profile) {
    return <PageSpinner />;
  }

  const nextStatusOptions = profile
    ? getNextStatusOptions(profile.status)
    : [];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(personalMode ? '/personal/profile' : '/hr/employees')}
          >
            {personalMode ? 'Quay lại hồ sơ' : 'Quay lại danh sách'}
          </Button>
          <Link to={personalMode ? '/personal/profile' : `/hr/employees/${id}`}>
            <Button>Xem chi tiết</Button>
          </Link>
          {canEdit && !locked ? (
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saveMutation.isPending}
              onClick={() =>
                void personalForm.validateFields().then((values) => savePersonal(values))
              }
            >
              Lưu
            </Button>
          ) : null}
        </Space>
        {profile ? (
          canChangeStatus && nextStatusOptions.length > 0 ? (
            <Dropdown.Button
              type="default"
              loading={statusMutation.isPending}
              icon={<DownOutlined />}
              menu={{
                items: nextStatusOptions.map((option) => ({
                  key: option.value,
                  label: option.label,
                  onClick: () => void changeStatus(option.value),
                })),
              }}
            >
              <Tag
                color={profileStatusColor(profile.status)}
                style={{ marginInlineEnd: 0 }}
              >
                {profileStatusLabel(profile.status)}
              </Tag>
            </Dropdown.Button>
          ) : (
            <Tag color={profileStatusColor(profile.status)}>
              {profileStatusLabel(profile.status)}
            </Tag>
          )
        ) : null}
      </Space>

      <Card title={`Chỉnh sửa sơ yếu lý lịch · ${profile?.profileCode ?? ''}`} loading={loading}>
        <EmployeeFieldSettingsContext.Provider value={fieldSettingsCtx}>
        <Form
          form={personalForm}
          layout="vertical"
          disabled={locked || !canEdit}
        >
          <Row gutter={24}>
            <Col xs={24} lg={14}>
              <Card size="small" title="Thông tin hồ sơ">
                <div style={{ marginBottom: 16 }}>
                  <EmployeeAvatarField
                    employeeId={id}
                    endpoint={personalMode ? '/personal/profile/avatar' : undefined}
                    avatarUrl={profile?.avatarUrl}
                    disabled={locked || !canEdit}
                    onUploaded={(avatarUrl) => {
                      updateProfileAvatar(avatarUrl);
                    }}
                  />
                </div>

                <Tabs
                  items={visibleTabs.map((tab) => ({
                    key: tab.id,
                    label: tab.name,
                    children: (
                      <DynamicProfileFields
                        fields={tab.fields}
                        disabled={locked || !canEdit}
                        onFocusField={setActiveGuide}
                        managingCompany={profile?.managingCompany ?? null}
                      />
                    ),
                  }))}
                />
              </Card>
            </Col>

            <Col xs={24} lg={10}>
              <Card
                size="small"
                title="Hướng dẫn nhập liệu"
                style={{ position: 'sticky', top: 16 }}
              >
                <Typography.Title level={5} style={{ marginTop: 0 }}>
                  {activeGuide.label}
                </Typography.Title>
                <Typography.Paragraph>{activeGuide.guide}</Typography.Paragraph>
                {activeGuide.hint ? (
                  <Alert
                    type="info"
                    showIcon
                    message="Ví dụ"
                    description={activeGuide.hint}
                  />
                ) : (
                  <Typography.Text type="secondary">
                    Chọn hoặc focus vào một trường bên trái để xem hướng dẫn tương ứng.
                  </Typography.Text>
                )}
              </Card>
            </Col>
          </Row>
        </Form>
        </EmployeeFieldSettingsContext.Provider>
      </Card>

      {isVisible('section.family') ? (
      <Card
        title={SECTION_TITLES.family}
        extra={
          canEdit && !locked ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setFamilyEditingId(null);
                familyForm.resetFields();
                setFamilyModalOpen(true);
              }}
            >
              Thêm người thân
            </Button>
          ) : null
        }
      >
        <Input.Search
          placeholder="Tìm trong quan hệ gia đình"
          style={{ marginBottom: 16, maxWidth: 360 }}
          value={familySearch}
          onChange={(e) => setFamilySearch(e.target.value)}
          onSearch={() => setFamilyPageNum(1)}
        />
        <Table
          rowKey="id"
          dataSource={familyPage.items}
          pagination={{
            current: familyPageNum,
            pageSize: familyPageSize,
            total: familyPage.total,
            onChange: (page, pageSize) => {
              setFamilyPageNum(page);
              setFamilyPageSize(pageSize);
            },
          }}
          columns={[
            {
              title: 'STT',
              render: (_, __, index) => (familyPageNum - 1) * familyPageSize + index + 1,
              width: 70,
            },
            { title: 'Quan hệ', dataIndex: 'relationship' },
            { title: 'Họ tên', dataIndex: 'fullName' },
            { title: 'Năm sinh', dataIndex: 'birthYear', render: (v) => v ?? '—' },
            { title: 'Nghề nghiệp', dataIndex: 'occupation', render: (v) => v ?? '—' },
            {
              title: 'Thao tác',
              render: (_, row, index) =>
                canEdit && !locked ? (
                  <Space>
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => {
                        setFamilyEditingId(row.id);
                        familyForm.setFieldsValue({ ...row } as FamilyFormValues);
                        setFamilyModalOpen(true);
                      }}
                    />
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() =>
                        void api
                          .delete(`${profileEndpoint}/family-members/${row.id}`)
                          .then(() => invalidateCollections())
                      }
                    />
                    <Button
                      size="small"
                      disabled={index === 0}
                      onClick={() => {
                        const next = moveItem(familyPage.items, index, index - 1);
                        void api
                          .patch(`${profileEndpoint}/family-members/reorder`, {
                            orderedIds: next.map((item) => item.id),
                          })
                          .then(() =>
                            invalidateCollections(),
                          );
                      }}
                    >
                      ↑
                    </Button>
                    <Button
                      size="small"
                      disabled={index >= familyPage.items.length - 1}
                      onClick={() => {
                        const next = moveItem(familyPage.items, index, index + 1);
                        void api
                          .patch(`${profileEndpoint}/family-members/reorder`, {
                            orderedIds: next.map((item) => item.id),
                          })
                          .then(() =>
                            invalidateCollections(),
                          );
                      }}
                    >
                      ↓
                    </Button>
                  </Space>
                ) : null,
            },
          ]}
        />
      </Card>
      ) : null}

      {isVisible('section.education') ? (
      <Card
        title={SECTION_TITLES.education}
        extra={
          canEdit && !locked ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEducationEditingId(null);
                educationForm.resetFields();
                setEducationModalOpen(true);
              }}
            >
              Thêm quá trình đào tạo
            </Button>
          ) : null
        }
      >
        <Input.Search
          placeholder="Tìm trong quá trình đào tạo"
          style={{ marginBottom: 16, maxWidth: 360 }}
          value={educationSearch}
          onChange={(e) => setEducationSearch(e.target.value)}
          onSearch={() => setEducationPageNum(1)}
        />
        <Table
          rowKey="id"
          dataSource={educationPage.items}
          pagination={{
            current: educationPageNum,
            pageSize: educationPageSize,
            total: educationPage.total,
            onChange: (page, pageSize) => {
              setEducationPageNum(page);
              setEducationPageSize(pageSize);
            },
          }}
          columns={[
            {
              title: 'STT',
              render: (_, __, index) =>
                (educationPageNum - 1) * educationPageSize + index + 1,
              width: 70,
            },
            {
              title: 'Thời gian',
              render: (_, row) => `${formatMonth(row.fromMonth)} – ${formatMonth(row.toMonth)}`,
            },
            { title: 'Cơ sở', dataIndex: 'institution' },
            { title: 'Ngành', dataIndex: 'major' },
            { title: 'Văn bằng', dataIndex: 'degree' },
            {
              title: 'Thao tác',
              render: (_, row, index) =>
                canEdit && !locked ? (
                  <Space>
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => {
                        setEducationEditingId(row.id);
                        educationForm.setFieldsValue({
                          ...row,
                          fromMonth: monthValue(row.fromMonth),
                          toMonth: monthValue(row.toMonth),
                        });
                        setEducationModalOpen(true);
                      }}
                    />
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() =>
                        void api
                          .delete(`${profileEndpoint}/education-histories/${row.id}`)
                          .then(() =>
                            invalidateCollections(),
                          )
                      }
                    />
                    <Button
                      size="small"
                      disabled={index === 0}
                      onClick={() => {
                        const next = moveItem(educationPage.items, index, index - 1);
                        void api
                          .patch(`${profileEndpoint}/education-histories/reorder`, {
                            orderedIds: next.map((item) => item.id),
                          })
                          .then(() =>
                            invalidateCollections(),
                          );
                      }}
                    >
                      ↑
                    </Button>
                    <Button
                      size="small"
                      disabled={index >= educationPage.items.length - 1}
                      onClick={() => {
                        const next = moveItem(educationPage.items, index, index + 1);
                        void api
                          .patch(`${profileEndpoint}/education-histories/reorder`, {
                            orderedIds: next.map((item) => item.id),
                          })
                          .then(() =>
                            invalidateCollections(),
                          );
                      }}
                    >
                      ↓
                    </Button>
                  </Space>
                ) : null,
            },
          ]}
        />
      </Card>
      ) : null}

      {isVisible('section.work') ? (
      <Card
        title={SECTION_TITLES.work}
        extra={
          canEdit && !locked ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setWorkEditingId(null);
                workForm.resetFields();
                setWorkModalOpen(true);
              }}
            >
              Thêm quá trình công tác
            </Button>
          ) : null
        }
      >
        <Input.Search
          placeholder="Tìm trong quá trình công tác"
          style={{ marginBottom: 16, maxWidth: 360 }}
          value={workSearch}
          onChange={(e) => setWorkSearch(e.target.value)}
          onSearch={() => setWorkPageNum(1)}
        />
        <Table
          rowKey="id"
          dataSource={workPage.items}
          pagination={{
            current: workPageNum,
            pageSize: workPageSize,
            total: workPage.total,
            onChange: (page, pageSize) => {
              setWorkPageNum(page);
              setWorkPageSize(pageSize);
            },
          }}
          columns={[
            {
              title: 'STT',
              render: (_, __, index) => (workPageNum - 1) * workPageSize + index + 1,
              width: 70,
            },
            {
              title: 'Thời gian',
              render: (_, row) =>
                `${formatMonth(row.fromMonth)} – ${row.toMonth ? formatMonth(row.toMonth) : 'Hiện tại'}`,
            },
            { title: 'Công ty', dataIndex: 'company' },
            { title: 'Chức vụ', dataIndex: 'position' },
            {
              title: 'Thao tác',
              render: (_, row, index) =>
                canEdit && !locked ? (
                  <Space>
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => {
                        setWorkEditingId(row.id);
                        workForm.setFieldsValue({
                          ...row,
                          fromMonth: monthValue(row.fromMonth),
                          toMonth: monthValue(row.toMonth),
                        });
                        setWorkModalOpen(true);
                      }}
                    />
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() =>
                        void api
                          .delete(`${profileEndpoint}/work-histories/${row.id}`)
                          .then(() =>
                            invalidateCollections(),
                          )
                      }
                    />
                    <Button
                      size="small"
                      disabled={index === 0}
                      onClick={() => {
                        const next = moveItem(workPage.items, index, index - 1);
                        void api
                          .patch(`${profileEndpoint}/work-histories/reorder`, {
                            orderedIds: next.map((item) => item.id),
                          })
                          .then(() =>
                            invalidateCollections(),
                          );
                      }}
                    >
                      ↑
                    </Button>
                    <Button
                      size="small"
                      disabled={index >= workPage.items.length - 1}
                      onClick={() => {
                        const next = moveItem(workPage.items, index, index + 1);
                        void api
                          .patch(`${profileEndpoint}/work-histories/reorder`, {
                            orderedIds: next.map((item) => item.id),
                          })
                          .then(() =>
                            invalidateCollections(),
                          );
                      }}
                    >
                      ↓
                    </Button>
                  </Space>
                ) : null,
            },
          ]}
        />
      </Card>
      ) : null}

      <EmployeeDocumentsSection
        endpoint={profileEndpoint}
        canEdit={Boolean(canEdit && !locked)}
      />

      <Modal
        title={familyEditingId ? 'Sửa người thân' : 'Thêm người thân'}
        open={familyModalOpen}
        onCancel={() => setFamilyModalOpen(false)}
        onOk={() =>
          void familyForm.validateFields().then(async (values) => {
            if (familyEditingId) {
              await api.patch(
                `${profileEndpoint}/family-members/${familyEditingId}`,
                values,
              );
            } else {
              await api.post(`${profileEndpoint}/family-members`, values);
            }
            setFamilyModalOpen(false);
            invalidateCollections();
          })
        }
        destroyOnHidden
      >
        <Form form={familyForm} layout="vertical">
          <GuidedFormItem name="relationship" meta={FAMILY_MEMBER_FIELDS.relationship} required>
            <Select options={FAMILY_RELATIONSHIP_OPTIONS} />
          </GuidedFormItem>
          <GuidedFormItem name="fullName" meta={FAMILY_MEMBER_FIELDS.fullName} required>
            <Input />
          </GuidedFormItem>
          <GuidedFormItem name="birthYear" meta={FAMILY_MEMBER_FIELDS.birthYear}>
            <InputNumber style={{ width: '100%' }} min={1900} max={2200} />
          </GuidedFormItem>
          <GuidedFormItem name="occupation" meta={FAMILY_MEMBER_FIELDS.occupation}>
            <Input />
          </GuidedFormItem>
          <GuidedFormItem name="workplace" meta={FAMILY_MEMBER_FIELDS.workplace}>
            <Input />
          </GuidedFormItem>
          <GuidedFormItem name="currentResidence" meta={FAMILY_MEMBER_FIELDS.currentResidence}>
            <Input.TextArea rows={2} />
          </GuidedFormItem>
        </Form>
      </Modal>

      <Modal
        title={educationEditingId ? 'Sửa quá trình đào tạo' : 'Thêm quá trình đào tạo'}
        open={educationModalOpen}
        onCancel={() => setEducationModalOpen(false)}
        onOk={() =>
          void educationForm.validateFields().then(async (values) => {
            if (educationEditingId) {
              await api.patch(
                `${profileEndpoint}/education-histories/${educationEditingId}`,
                values,
              );
            } else {
              await api.post(`${profileEndpoint}/education-histories`, values);
            }
            setEducationModalOpen(false);
            invalidateCollections();
          })
        }
        destroyOnHidden
      >
        <Form form={educationForm} layout="vertical">
          <GuidedFormItem name="fromMonth" meta={EDUCATION_FIELDS.fromMonth} required>
            <Input type="month" />
          </GuidedFormItem>
          <GuidedFormItem name="toMonth" meta={EDUCATION_FIELDS.toMonth} required>
            <Input type="month" />
          </GuidedFormItem>
          <GuidedFormItem name="institution" meta={EDUCATION_FIELDS.institution} required>
            <Input />
          </GuidedFormItem>
          <GuidedFormItem name="major" meta={EDUCATION_FIELDS.major} required>
            <Input />
          </GuidedFormItem>
          <GuidedFormItem name="trainingMode" meta={EDUCATION_FIELDS.trainingMode} required>
            <Select options={TRAINING_MODE_OPTIONS} />
          </GuidedFormItem>
          <GuidedFormItem name="degree" meta={EDUCATION_FIELDS.degree} required>
            <Input />
          </GuidedFormItem>
        </Form>
      </Modal>

      <Modal
        title={workEditingId ? 'Sửa quá trình công tác' : 'Thêm quá trình công tác'}
        open={workModalOpen}
        onCancel={() => setWorkModalOpen(false)}
        onOk={() =>
          void workForm.validateFields().then(async (values) => {
            if (workEditingId) {
              await api.patch(`${profileEndpoint}/work-histories/${workEditingId}`, values);
            } else {
              await api.post(`${profileEndpoint}/work-histories`, values);
            }
            setWorkModalOpen(false);
            invalidateCollections();
          })
        }
        destroyOnHidden
      >
        <Form form={workForm} layout="vertical">
          <GuidedFormItem name="fromMonth" meta={WORK_FIELDS.fromMonth} required>
            <Input type="month" />
          </GuidedFormItem>
          <GuidedFormItem name="toMonth" meta={WORK_FIELDS.toMonth}>
            <Input type="month" />
          </GuidedFormItem>
          <GuidedFormItem name="company" meta={WORK_FIELDS.company} required>
            <Input />
          </GuidedFormItem>
          <GuidedFormItem name="department" meta={WORK_FIELDS.department}>
            <Input />
          </GuidedFormItem>
          <GuidedFormItem name="position" meta={WORK_FIELDS.position} required>
            <Input />
          </GuidedFormItem>
        </Form>
      </Modal>
    </Space>
  );
}
