import { useEffect, useState } from 'react';
import { Alert, Form, Input, Modal, Select, message } from 'antd';
import { useNavigate } from 'react-router';
import { getApiErrorMessage } from '../../lib/errors';
import { api } from '../../lib/api';
import type { CheckOrCreateResult } from './employee-types';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface FormValues {
  fullName: string;
  phone: string;
  managingCompanyId: string;
}

interface CompanyOption {
  id: string;
  name: string;
  status: string;
}

export function EmployeeCreateDialog({ open, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    setLoadingCompanies(true);
    api
      .get<CompanyOption[]>('/organization/companies')
      .then(({ data }) => setCompanies(data))
      .catch(() => {
        setCompanies([]);
        message.error('Không tải được danh sách công ty');
      })
      .finally(() => setLoadingCompanies(false));
  }, [open]);

  const handleOk = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const { data } = await api.post<CheckOrCreateResult>(
        '/employees/check-or-create',
        {
          fullName: values.fullName.trim(),
          phone: values.phone.replace(/\D/g, ''),
          managingCompanyId: values.managingCompanyId,
        },
      );
      onClose();
      form.resetFields();
      if (data.created) {
        message.success(
          `Đã tạo hồ sơ ${data.profile.profileCode}. Tiếp tục khai báo sơ yếu lý lịch.`,
        );
        navigate(`/hr/employees/${data.profile.id}/edit`);
      } else {
        message.info(
          `Hồ sơ đã có trên hệ thống (${data.profile.profileCode}). Chuyển tới chi tiết.`,
        );
        navigate(`/hr/employees/${data.profile.id}`);
      }
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không tạo được hồ sơ'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Thêm hồ sơ mới"
      open={open}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      onOk={() => void handleOk()}
      confirmLoading={submitting}
      okText="Tiếp tục"
      cancelText="Hủy"
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Công ty chủ quản khai báo ở đây là cùng trường với Thông tin hợp đồng — sẽ được lưu ngay khi tạo hồ sơ và hiện trên form chỉnh sửa."
      />
      <Form form={form} layout="vertical">
        <Form.Item
          name="fullName"
          label="Họ và tên"
          rules={[{ required: true, message: 'Nhập họ và tên' }]}
        >
          <Input placeholder="NGUYỄN VĂN A" autoFocus />
        </Form.Item>
        <Form.Item
          name="phone"
          label="Số điện thoại"
          rules={[
            { required: true, message: 'Nhập số điện thoại' },
            {
              pattern: /^\d{10,11}$/,
              message: 'SĐT gồm 10–11 chữ số',
            },
          ]}
          normalize={(value: string) => value?.replace(/\D/g, '') ?? ''}
        >
          <Input placeholder="09xxxxxxxx" inputMode="numeric" />
        </Form.Item>
        <Form.Item
          name="managingCompanyId"
          label="Công ty chủ quản"
          rules={[{ required: true, message: 'Chọn công ty chủ quản' }]}
          extra="Đồng bộ với tab Thông tin hợp đồng trên hồ sơ."
        >
          <Select
            showSearch
            optionFilterProp="label"
            loading={loadingCompanies}
            placeholder="Chọn công ty"
            options={companies
              .filter((company) => company.status === 'ACTIVE')
              .map((company) => ({
                value: company.id,
                label: company.name,
              }))}
            notFoundContent={
              loadingCompanies ? 'Đang tải…' : 'Chưa có công ty đang hoạt động'
            }
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
