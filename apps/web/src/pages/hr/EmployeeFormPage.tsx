import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router';
import { EntityStatus, Permissions } from '@erp/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  EDUCATION_LEVEL_OPTIONS,
  ETHNICITY_OPTIONS,
  FAMILY_RELATIONSHIP_OPTIONS,
  GENDER_OPTIONS,
  RELIGION_OPTIONS,
  TRAINING_MODE_OPTIONS,
} from './employee-catalogs';
import {
  EDUCATION_FIELDS,
  EMPLOYEE_FIELDS,
  FAMILY_MEMBER_FIELDS,
  GuidedFormItem,
  SECTION_TITLES,
  WORK_FIELDS,
} from './employee-fields';
import type {
  EmployeeCollectionPage,
  EmployeeEducationHistory,
  EmployeeFamilyMember,
  EmployeeProfileDetail,
  EmployeeWorkHistory,
} from './employee-types';

type PersonalFormValues = {
  fullName: string;
  gender: string;
  birthDate: string;
  birthPlace: string;
  placeOfOrigin: string;
  permanentAddress: string;
  currentAddress: string;
  phone: string;
  email: string;
  ethnicity: string;
  religion?: string;
  identityNumber: string;
  identityIssuedDate: string;
  identityIssuedPlace: string;
  educationLevel: string;
  youthUnionAdmissionDate?: string;
  youthUnionAdmissionPlace?: string;
  partyAdmissionDate?: string;
  partyAdmissionPlace?: string;
  rewardDiscipline?: string;
  strengths?: string;
  status: EntityStatus;
};

type FamilyFormValues = {
  relationship: string;
  fullName: string;
  birthYear?: number;
  occupation?: string;
  workplace?: string;
  currentResidence?: string;
};

type EducationFormValues = {
  fromMonth: string;
  toMonth: string;
  institution: string;
  major: string;
  trainingMode: string;
  degree: string;
};

type WorkFormValues = {
  fromMonth: string;
  toMonth?: string;
  company: string;
  department?: string;
  position: string;
};

const dateValue = (value?: string | null) => value?.slice(0, 10) || undefined;
const monthValue = (value?: string | null) => value?.slice(0, 7) || undefined;

function normalizePayload<T extends Record<string, unknown>>(values: T) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trim() || null : value ?? null,
    ]),
  );
}

function extractErrorMessage(error: unknown, fallback: string) {
  const messageValue =
    error && typeof error === 'object' && 'response' in error
      ? (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
      : undefined;
  if (typeof messageValue === 'string') return messageValue;
  if (Array.isArray(messageValue) && messageValue[0]) return String(messageValue[0]);
  return fallback;
}

function formatMonth(value?: string | null) {
  if (!value) return 'Hiện tại';
  const [year, month] = value.slice(0, 7).split('-');
  return `${month}/${year}`;
}

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function EmployeeFormPage() {
  const { id } = useParams<{ id: string }>();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(Permissions.HR_EMPLOYEE_UPDATE);

  const [personalForm] = Form.useForm<PersonalFormValues>();
  const [familyForm] = Form.useForm<FamilyFormValues>();
  const [educationForm] = Form.useForm<EducationFormValues>();
  const [workForm] = Form.useForm<WorkFormValues>();

  const [profile, setProfile] = useState<EmployeeProfileDetail | null>(null);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [familyPage, setFamilyPage] = useState<EmployeeCollectionPage<EmployeeFamilyMember>>({ items: [], total: 0, page: 1, pageSize: 10 });
  const [educationPage, setEducationPage] = useState<EmployeeCollectionPage<EmployeeEducationHistory>>({ items: [], total: 0, page: 1, pageSize: 10 });
  const [workPage, setWorkPage] = useState<EmployeeCollectionPage<EmployeeWorkHistory>>({ items: [], total: 0, page: 1, pageSize: 10 });
  const [familySearch, setFamilySearch] = useState('');
  const [educationSearch, setEducationSearch] = useState('');
  const [workSearch, setWorkSearch] = useState('');
  const [familyEditingId, setFamilyEditingId] = useState<string | null>(null);
  const [educationEditingId, setEducationEditingId] = useState<string | null>(null);
  const [workEditingId, setWorkEditingId] = useState<string | null>(null);
  const [familyModalOpen, setFamilyModalOpen] = useState(false);
  const [educationModalOpen, setEducationModalOpen] = useState(false);
  const [workModalOpen, setWorkModalOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await api.get<EmployeeProfileDetail>(`/employees/${id}`);
      setProfile(data);
      personalForm.setFieldsValue({
        ...data,
        religion: data.religion ?? undefined,
        youthUnionAdmissionPlace: data.youthUnionAdmissionPlace ?? undefined,
        partyAdmissionPlace: data.partyAdmissionPlace ?? undefined,
        rewardDiscipline: data.rewardDiscipline ?? undefined,
        strengths: data.strengths ?? undefined,
        birthDate: dateValue(data.birthDate),
        identityIssuedDate: dateValue(data.identityIssuedDate),
        youthUnionAdmissionDate: dateValue(data.youthUnionAdmissionDate),
        partyAdmissionDate: dateValue(data.partyAdmissionDate),
      });
    } catch (error) {
      message.error(extractErrorMessage(error, 'Không tải được hồ sơ nhân viên'));
    } finally {
      setLoading(false);
    }
  }, [id, personalForm]);

  const loadFamily = useCallback(async (page = 1, pageSize = familyPage.pageSize, search = familySearch) => {
    if (!id) return;
    const { data } = await api.get<EmployeeCollectionPage<EmployeeFamilyMember>>(`/employees/${id}/family-members`, {
      params: { page, pageSize, search: search.trim() || undefined },
    });
    setFamilyPage(data);
  }, [id, familyPage.pageSize, familySearch]);

  const loadEducation = useCallback(async (page = 1, pageSize = educationPage.pageSize, search = educationSearch) => {
    if (!id) return;
    const { data } = await api.get<EmployeeCollectionPage<EmployeeEducationHistory>>(`/employees/${id}/education-histories`, {
      params: { page, pageSize, search: search.trim() || undefined },
    });
    setEducationPage(data);
  }, [id, educationPage.pageSize, educationSearch]);

  const loadWork = useCallback(async (page = 1, pageSize = workPage.pageSize, search = workSearch) => {
    if (!id) return;
    const { data } = await api.get<EmployeeCollectionPage<EmployeeWorkHistory>>(`/employees/${id}/work-histories`, {
      params: { page, pageSize, search: search.trim() || undefined },
    });
    setWorkPage(data);
  }, [id, workPage.pageSize, workSearch]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!id) return;
    void loadFamily();
    void loadEducation();
    void loadWork();
  }, [id, loadFamily, loadEducation, loadWork]);

  const savePersonal = async (values: PersonalFormValues, stay = false) => {
    setSaving(true);
    try {
      const payload = normalizePayload(values);
      if (id) {
        await api.patch(`/employees/${id}`, payload);
        message.success('Cập nhật sơ yếu lý lịch thành công');
        await loadProfile();
        if (!stay) navigate(`/hr/employees/${id}`);
      } else {
        const { data } = await api.post<EmployeeProfileDetail>('/employees', payload);
        message.success('Tạo sơ yếu lý lịch thành công');
        navigate(stay ? `/hr/employees/${data.id}/edit` : `/hr/employees/${data.id}`);
      }
    } catch (error) {
      message.error(extractErrorMessage(error, 'Không lưu được sơ yếu lý lịch'));
    } finally {
      setSaving(false);
    }
  };

  const reorderFamily = async (from: number, to: number) => {
    if (!id || from === to) return;
    const next = moveItem(familyPage.items, from, to);
    await api.patch(`/employees/${id}/family-members/reorder`, { orderedIds: next.map((item) => item.id) });
    await loadFamily(familyPage.page, familyPage.pageSize, familySearch);
  };

  const reorderEducation = async (from: number, to: number) => {
    if (!id || from === to) return;
    const next = moveItem(educationPage.items, from, to);
    await api.patch(`/employees/${id}/education-histories/reorder`, { orderedIds: next.map((item) => item.id) });
    await loadEducation(educationPage.page, educationPage.pageSize, educationSearch);
  };

  const reorderWork = async (from: number, to: number) => {
    if (!id || from === to) return;
    const next = moveItem(workPage.items, from, to);
    await api.patch(`/employees/${id}/work-histories/reorder`, { orderedIds: next.map((item) => item.id) });
    await loadWork(workPage.page, workPage.pageSize, workSearch);
  };

  const collectionDisabled = !id;
  const statusTag = useMemo(() => {
    const status = personalForm.getFieldValue('status') ?? profile?.status ?? EntityStatus.ACTIVE;
    return status === EntityStatus.ACTIVE ? <Tag color="green">Đang hoạt động</Tag> : <Tag color="red">Đã khóa</Tag>;
  }, [personalForm, profile?.status]);

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/hr/employees')}>Quay lại danh sách</Button>
          {editing && id ? <Link to={`/hr/employees/${id}`}><Button>Xem chi tiết</Button></Link> : null}
        </Space>
        {statusTag}
      </Space>

      <Card title={editing ? 'Chỉnh sửa sơ yếu lý lịch' : 'Khai báo sơ yếu lý lịch'} loading={loading}>
        <Typography.Paragraph type="secondary">
          Thông tin bản thân sử dụng bố cục 2 cột. Ba nhóm dữ liệu còn lại quản lý theo từng dòng bằng modal.
        </Typography.Paragraph>
        <Form form={personalForm} layout="vertical" initialValues={{ status: EntityStatus.ACTIVE }} onFinish={(values) => void savePersonal(values, false)}>
          <Card size="small" title={SECTION_TITLES.personal}>
            <Row gutter={16}>
              <Col xs={24} md={12}><GuidedFormItem name="fullName" meta={EMPLOYEE_FIELDS.fullName} required><Input /></GuidedFormItem></Col>
              <Col xs={24} md={12}><GuidedFormItem name="gender" meta={EMPLOYEE_FIELDS.gender} required><Select options={GENDER_OPTIONS} /></GuidedFormItem></Col>
              <Col xs={24} md={12}><GuidedFormItem name="birthDate" meta={EMPLOYEE_FIELDS.birthDate} required><Input type="date" /></GuidedFormItem></Col>
              <Col xs={24} md={12}><GuidedFormItem name="birthPlace" meta={EMPLOYEE_FIELDS.birthPlace} required><Input /></GuidedFormItem></Col>
              <Col xs={24} md={12}><GuidedFormItem name="placeOfOrigin" meta={EMPLOYEE_FIELDS.placeOfOrigin} required><Input /></GuidedFormItem></Col>
              <Col xs={24} md={12}><GuidedFormItem name="phone" meta={EMPLOYEE_FIELDS.phone} required rules={[{ required: true, message: 'Nhập số điện thoại' }, { pattern: /^\d{10,11}$/, message: 'Số điện thoại phải gồm 10-11 chữ số' }]}><Input /></GuidedFormItem></Col>
              <Col xs={24} md={12}><GuidedFormItem name="email" meta={EMPLOYEE_FIELDS.email} required rules={[{ required: true, message: 'Nhập email' }, { type: 'email', message: 'Email không hợp lệ' }]}><Input /></GuidedFormItem></Col>
              <Col xs={24} md={12}><GuidedFormItem name="ethnicity" meta={EMPLOYEE_FIELDS.ethnicity} required><Select showSearch optionFilterProp="label" options={ETHNICITY_OPTIONS} /></GuidedFormItem></Col>
              <Col xs={24} md={12}><GuidedFormItem name="religion" meta={EMPLOYEE_FIELDS.religion}><Select allowClear options={RELIGION_OPTIONS} /></GuidedFormItem></Col>
              <Col xs={24} md={12}><GuidedFormItem name="identityNumber" meta={EMPLOYEE_FIELDS.identityNumber} required rules={[{ required: true, message: 'Nhập CCCD/CMND' }, { pattern: /^\d{12}$/, message: 'CCCD phải gồm 12 số' }]}><Input /></GuidedFormItem></Col>
              <Col xs={24} md={12}><GuidedFormItem name="identityIssuedDate" meta={EMPLOYEE_FIELDS.identityIssuedDate} required><Input type="date" /></GuidedFormItem></Col>
              <Col xs={24} md={12}><GuidedFormItem name="identityIssuedPlace" meta={EMPLOYEE_FIELDS.identityIssuedPlace} required><Input /></GuidedFormItem></Col>
              <Col xs={24} md={12}><GuidedFormItem name="educationLevel" meta={EMPLOYEE_FIELDS.educationLevel} required><Select options={EDUCATION_LEVEL_OPTIONS} /></GuidedFormItem></Col>
              <Col xs={24}><GuidedFormItem name="permanentAddress" meta={EMPLOYEE_FIELDS.permanentAddress} required><Input.TextArea rows={3} /></GuidedFormItem></Col>
              <Col xs={24}><GuidedFormItem name="currentAddress" meta={EMPLOYEE_FIELDS.currentAddress} required><Input.TextArea rows={3} /></GuidedFormItem></Col>
              <Col xs={24} md={12}><GuidedFormItem name="youthUnionAdmissionDate" meta={EMPLOYEE_FIELDS.youthUnionAdmissionDate}><Input type="date" /></GuidedFormItem></Col>
              <Col xs={24} md={12}><GuidedFormItem name="youthUnionAdmissionPlace" meta={EMPLOYEE_FIELDS.youthUnionAdmissionPlace}><Input /></GuidedFormItem></Col>
              <Col xs={24} md={12}><GuidedFormItem name="partyAdmissionDate" meta={EMPLOYEE_FIELDS.partyAdmissionDate}><Input type="date" /></GuidedFormItem></Col>
              <Col xs={24} md={12}><GuidedFormItem name="partyAdmissionPlace" meta={EMPLOYEE_FIELDS.partyAdmissionPlace}><Input /></GuidedFormItem></Col>
              <Col xs={24}><GuidedFormItem name="rewardDiscipline" meta={EMPLOYEE_FIELDS.rewardDiscipline}><Input.TextArea rows={4} /></GuidedFormItem></Col>
              <Col xs={24}><GuidedFormItem name="strengths" meta={EMPLOYEE_FIELDS.strengths}><Input.TextArea rows={4} /></GuidedFormItem></Col>
              <Col xs={24} md={12}><GuidedFormItem name="status" meta={EMPLOYEE_FIELDS.status} required><Select options={[{ value: EntityStatus.ACTIVE, label: 'Đang hoạt động' }, { value: EntityStatus.INACTIVE, label: 'Đã khóa' }]} /></GuidedFormItem></Col>
            </Row>
          </Card>
          <Space wrap style={{ marginTop: 16 }}>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>Lưu</Button>
            <Button loading={saving} onClick={() => void personalForm.validateFields().then((values) => savePersonal(values, true))}>Lưu và tiếp tục</Button>
            <Button icon={<ReloadOutlined />} onClick={() => { personalForm.resetFields(); void loadProfile(); }}>Làm mới</Button>
            <Button onClick={() => navigate('/hr/employees')}>Hủy</Button>
          </Space>
        </Form>
      </Card>

      {collectionDisabled ? <Alert type="info" showIcon message="Lưu thông tin bản thân trước để tiếp tục khai báo các bảng chi tiết." /> : null}

      <Card title={SECTION_TITLES.family} extra={canEdit && !collectionDisabled ? <Button type="primary" icon={<PlusOutlined />} onClick={() => { setFamilyEditingId(null); familyForm.resetFields(); setFamilyModalOpen(true); }}>Thêm người thân</Button> : null}>
        <Input.Search placeholder="Tìm trong quan hệ gia đình" style={{ marginBottom: 16, maxWidth: 360 }} value={familySearch} onChange={(e) => setFamilySearch(e.target.value)} onSearch={() => void loadFamily(1, familyPage.pageSize, familySearch)} />
        <Table rowKey="id" dataSource={familyPage.items} pagination={{ current: familyPage.page, pageSize: familyPage.pageSize, total: familyPage.total, onChange: (page, pageSize) => void loadFamily(page, pageSize, familySearch) }} columns={[
          { title: 'STT', render: (_, __, index) => (familyPage.page - 1) * familyPage.pageSize + index + 1, width: 70 },
          { title: 'Quan hệ', dataIndex: 'relationship' },
          { title: 'Họ tên', dataIndex: 'fullName' },
          { title: 'Năm sinh', dataIndex: 'birthYear', render: (v) => v ?? '—' },
          { title: 'Nghề nghiệp', dataIndex: 'occupation', render: (v) => v ?? '—' },
          { title: 'Cơ quan công tác', dataIndex: 'workplace', render: (v) => v ?? '—' },
          { title: 'Chỗ ở hiện nay', dataIndex: 'currentResidence', render: (v) => v ?? '—' },
          { title: 'Thao tác', render: (_, record, index) => <Space><Button size="small" disabled={index === 0} onClick={() => void reorderFamily(index, index - 1)}>Lên</Button><Button size="small" disabled={index === familyPage.items.length - 1} onClick={() => void reorderFamily(index, index + 1)}>Xuống</Button><Button size="small" icon={<EditOutlined />} onClick={() => { setFamilyEditingId(record.id); familyForm.setFieldsValue({ relationship: record.relationship, fullName: record.fullName, birthYear: record.birthYear ?? undefined, occupation: record.occupation ?? undefined, workplace: record.workplace ?? undefined, currentResidence: record.currentResidence ?? undefined }); setFamilyModalOpen(true); }}>Sửa</Button><Button danger size="small" icon={<DeleteOutlined />} onClick={() => Modal.confirm({ title: 'Xóa người thân?', onOk: async () => { await api.delete(`/employees/${id}/family-members/${record.id}`); await loadFamily(familyPage.page, familyPage.pageSize, familySearch); } })}>Xóa</Button></Space> },
        ]} />
      </Card>

      <Card title={SECTION_TITLES.education} extra={canEdit && !collectionDisabled ? <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEducationEditingId(null); educationForm.resetFields(); setEducationModalOpen(true); }}>Thêm quá trình đào tạo</Button> : null}>
        <Input.Search placeholder="Tìm trong quá trình đào tạo" style={{ marginBottom: 16, maxWidth: 360 }} value={educationSearch} onChange={(e) => setEducationSearch(e.target.value)} onSearch={() => void loadEducation(1, educationPage.pageSize, educationSearch)} />
        <Table rowKey="id" dataSource={educationPage.items} pagination={{ current: educationPage.page, pageSize: educationPage.pageSize, total: educationPage.total, onChange: (page, pageSize) => void loadEducation(page, pageSize, educationSearch) }} columns={[
          { title: 'STT', render: (_, __, index) => (educationPage.page - 1) * educationPage.pageSize + index + 1, width: 70 },
          { title: 'Từ tháng', dataIndex: 'fromMonth', render: (v) => formatMonth(v) },
          { title: 'Đến tháng', dataIndex: 'toMonth', render: (v) => formatMonth(v) },
          { title: 'Trường/Cơ sở đào tạo', dataIndex: 'institution' },
          { title: 'Ngành học', dataIndex: 'major' },
          { title: 'Hình thức đào tạo', dataIndex: 'trainingMode' },
          { title: 'Văn bằng', dataIndex: 'degree' },
          { title: 'Thao tác', render: (_, record, index) => <Space><Button size="small" disabled={index === 0} onClick={() => void reorderEducation(index, index - 1)}>Lên</Button><Button size="small" disabled={index === educationPage.items.length - 1} onClick={() => void reorderEducation(index, index + 1)}>Xuống</Button><Button size="small" icon={<EditOutlined />} onClick={() => { setEducationEditingId(record.id); educationForm.setFieldsValue({ ...record, fromMonth: monthValue(record.fromMonth), toMonth: monthValue(record.toMonth) }); setEducationModalOpen(true); }}>Sửa</Button><Button danger size="small" icon={<DeleteOutlined />} onClick={() => Modal.confirm({ title: 'Xóa quá trình đào tạo?', onOk: async () => { await api.delete(`/employees/${id}/education-histories/${record.id}`); await loadEducation(educationPage.page, educationPage.pageSize, educationSearch); } })}>Xóa</Button></Space> },
        ]} />
      </Card>

      <Card title={SECTION_TITLES.work} extra={canEdit && !collectionDisabled ? <Button type="primary" icon={<PlusOutlined />} onClick={() => { setWorkEditingId(null); workForm.resetFields(); setWorkModalOpen(true); }}>Thêm quá trình công tác</Button> : null}>
        <Input.Search placeholder="Tìm trong quá trình công tác" style={{ marginBottom: 16, maxWidth: 360 }} value={workSearch} onChange={(e) => setWorkSearch(e.target.value)} onSearch={() => void loadWork(1, workPage.pageSize, workSearch)} />
        <Table rowKey="id" dataSource={workPage.items} pagination={{ current: workPage.page, pageSize: workPage.pageSize, total: workPage.total, onChange: (page, pageSize) => void loadWork(page, pageSize, workSearch) }} columns={[
          { title: 'STT', render: (_, __, index) => (workPage.page - 1) * workPage.pageSize + index + 1, width: 70 },
          { title: 'Từ tháng', dataIndex: 'fromMonth', render: (v) => formatMonth(v) },
          { title: 'Đến tháng', dataIndex: 'toMonth', render: (v) => v ? formatMonth(v) : 'Hiện tại' },
          { title: 'Công ty/Cơ quan', dataIndex: 'company' },
          { title: 'Đơn vị công tác', dataIndex: 'department', render: (v) => v ?? '—' },
          { title: 'Chức vụ', dataIndex: 'position' },
          { title: 'Thao tác', render: (_, record, index) => <Space><Button size="small" disabled={index === 0} onClick={() => void reorderWork(index, index - 1)}>Lên</Button><Button size="small" disabled={index === workPage.items.length - 1} onClick={() => void reorderWork(index, index + 1)}>Xuống</Button><Button size="small" icon={<EditOutlined />} onClick={() => { setWorkEditingId(record.id); workForm.setFieldsValue({ fromMonth: monthValue(record.fromMonth), toMonth: monthValue(record.toMonth) || undefined, company: record.company, department: record.department ?? undefined, position: record.position }); setWorkModalOpen(true); }}>Sửa</Button><Button danger size="small" icon={<DeleteOutlined />} onClick={() => Modal.confirm({ title: 'Xóa quá trình công tác?', onOk: async () => { await api.delete(`/employees/${id}/work-histories/${record.id}`); await loadWork(workPage.page, workPage.pageSize, workSearch); } })}>Xóa</Button></Space> },
        ]} />
      </Card>

      <Modal title={familyEditingId ? 'Sửa người thân' : 'Thêm người thân'} open={familyModalOpen} onCancel={() => setFamilyModalOpen(false)} onOk={() => familyForm.submit()} destroyOnHidden>
        <Form form={familyForm} layout="vertical" onFinish={async (values) => { try { if (familyEditingId) await api.patch(`/employees/${id}/family-members/${familyEditingId}`, normalizePayload(values)); else await api.post(`/employees/${id}/family-members`, normalizePayload(values)); message.success('Đã lưu người thân'); setFamilyModalOpen(false); await loadFamily(familyPage.page, familyPage.pageSize, familySearch); } catch (error) { message.error(extractErrorMessage(error, 'Không lưu được người thân')); } }}>
          <GuidedFormItem name="relationship" meta={FAMILY_MEMBER_FIELDS.relationship} required><Select options={FAMILY_RELATIONSHIP_OPTIONS} /></GuidedFormItem>
          <GuidedFormItem name="fullName" meta={FAMILY_MEMBER_FIELDS.fullName} required><Input /></GuidedFormItem>
          <GuidedFormItem name="birthYear" meta={FAMILY_MEMBER_FIELDS.birthYear}><InputNumber style={{ width: '100%' }} min={1900} max={2200} /></GuidedFormItem>
          <GuidedFormItem name="occupation" meta={FAMILY_MEMBER_FIELDS.occupation}><Input /></GuidedFormItem>
          <GuidedFormItem name="workplace" meta={FAMILY_MEMBER_FIELDS.workplace}><Input /></GuidedFormItem>
          <GuidedFormItem name="currentResidence" meta={FAMILY_MEMBER_FIELDS.currentResidence}><Input.TextArea rows={3} /></GuidedFormItem>
        </Form>
      </Modal>

      <Modal title={educationEditingId ? 'Sửa quá trình đào tạo' : 'Thêm quá trình đào tạo'} open={educationModalOpen} onCancel={() => setEducationModalOpen(false)} onOk={() => educationForm.submit()} destroyOnHidden>
        <Form form={educationForm} layout="vertical" onFinish={async (values) => { try { if (educationEditingId) await api.patch(`/employees/${id}/education-histories/${educationEditingId}`, normalizePayload(values)); else await api.post(`/employees/${id}/education-histories`, normalizePayload(values)); message.success('Đã lưu quá trình đào tạo'); setEducationModalOpen(false); await loadEducation(educationPage.page, educationPage.pageSize, educationSearch); } catch (error) { message.error(extractErrorMessage(error, 'Không lưu được quá trình đào tạo')); } }}>
          <GuidedFormItem name="fromMonth" meta={EDUCATION_FIELDS.fromMonth} required><Input type="month" /></GuidedFormItem>
          <GuidedFormItem name="toMonth" meta={EDUCATION_FIELDS.toMonth} required><Input type="month" /></GuidedFormItem>
          <GuidedFormItem name="institution" meta={EDUCATION_FIELDS.institution} required><Input /></GuidedFormItem>
          <GuidedFormItem name="major" meta={EDUCATION_FIELDS.major} required><Input /></GuidedFormItem>
          <GuidedFormItem name="trainingMode" meta={EDUCATION_FIELDS.trainingMode} required><Select options={TRAINING_MODE_OPTIONS} /></GuidedFormItem>
          <GuidedFormItem name="degree" meta={EDUCATION_FIELDS.degree} required><Input /></GuidedFormItem>
        </Form>
      </Modal>

      <Modal title={workEditingId ? 'Sửa quá trình công tác' : 'Thêm quá trình công tác'} open={workModalOpen} onCancel={() => setWorkModalOpen(false)} onOk={() => workForm.submit()} destroyOnHidden>
        <Form form={workForm} layout="vertical" onFinish={async (values) => { try { if (workEditingId) await api.patch(`/employees/${id}/work-histories/${workEditingId}`, normalizePayload(values)); else await api.post(`/employees/${id}/work-histories`, normalizePayload(values)); message.success('Đã lưu quá trình công tác'); setWorkModalOpen(false); await loadWork(workPage.page, workPage.pageSize, workSearch); } catch (error) { message.error(extractErrorMessage(error, 'Không lưu được quá trình công tác')); } }}>
          <GuidedFormItem name="fromMonth" meta={WORK_FIELDS.fromMonth} required><Input type="month" /></GuidedFormItem>
          <GuidedFormItem name="toMonth" meta={WORK_FIELDS.toMonth}><Input type="month" /></GuidedFormItem>
          <GuidedFormItem name="company" meta={WORK_FIELDS.company} required><Input /></GuidedFormItem>
          <GuidedFormItem name="department" meta={WORK_FIELDS.department}><Input /></GuidedFormItem>
          <GuidedFormItem name="position" meta={WORK_FIELDS.position} required><Input /></GuidedFormItem>
        </Form>
      </Modal>
    </Space>
  );
}
