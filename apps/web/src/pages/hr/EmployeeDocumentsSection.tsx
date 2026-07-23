import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Upload,
  message,
} from 'antd';
import {
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { EmployeeDocumentType } from '@erp/shared';
import type { UploadFile } from 'antd';
import { api } from '../../lib/api';
import { resolveAvatarSrc } from './EmployeeAvatarField';

const DOCUMENT_TYPE_OPTIONS = [
  {
    value: EmployeeDocumentType.IDENTITY,
    label: 'Căn cước công dân (CCCD)/Hộ chiếu',
  },
  { value: EmployeeDocumentType.RESUME, label: 'Sơ yếu lý lịch' },
  { value: EmployeeDocumentType.JOB_APPLICATION, label: 'Đơn xin việc' },
  { value: EmployeeDocumentType.CV, label: 'CV (Sơ yếu nghề nghiệp)' },
  { value: EmployeeDocumentType.DEGREE, label: 'Bằng cấp, chứng chỉ' },
  {
    value: EmployeeDocumentType.HEALTH_CERTIFICATE,
    label: 'Giấy khám sức khỏe',
  },
  { value: EmployeeDocumentType.PORTRAIT_PHOTO, label: 'Ảnh thẻ' },
  { value: EmployeeDocumentType.SOCIAL_INSURANCE, label: 'Sổ bảo hiểm xã hội' },
  { value: EmployeeDocumentType.CRIMINAL_RECORD, label: 'Phiếu lý lịch tư pháp' },
  {
    value: EmployeeDocumentType.RESIDENCE_CONFIRMATION,
    label: 'Giấy xác nhận cư trú',
  },
  { value: EmployeeDocumentType.PRACTICE_LICENSE, label: 'Giấy phép hành nghề' },
  {
    value: EmployeeDocumentType.CERTIFICATE,
    label: 'Chứng chỉ chuyên môn khác',
  },
];

interface EmployeeDocument {
  id: string;
  documentType: EmployeeDocumentType;
  name: string;
  originalFileName: string;
  mimeType: string;
  size: number;
  fileUrl: string;
  createdAt: string;
}

interface DocumentFormValues {
  documentType: EmployeeDocumentType;
  name: string;
}

interface Props {
  endpoint: string;
  canEdit: boolean;
}

export function EmployeeDocumentsSection({ endpoint, canEdit }: Props) {
  const [form] = Form.useForm<DocumentFormValues>();
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const loadDocuments = useCallback(async () => {
    if (!endpoint) return;
    const { data } = await api.get<EmployeeDocument[]>(`${endpoint}/documents`);
    setDocuments(data);
  }, [endpoint]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const uploadDocument = async () => {
    const values = await form.validateFields();
    const file = fileList[0]?.originFileObj;
    if (!file) {
      message.warning('Vui lòng chọn file giấy tờ');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      message.error('File giấy tờ tối đa 10MB');
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.append('documentType', values.documentType);
      body.append('name', values.name.trim());
      body.append('file', file);
      await api.post(`${endpoint}/documents`, body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success('Đã upload giấy tờ');
      setDialogOpen(false);
      setFileList([]);
      form.resetFields();
      await loadDocuments();
    } catch (error) {
      const detail = (
        error as { response?: { data?: { message?: string | string[] } } }
      ).response?.data?.message;
      message.error(
        Array.isArray(detail)
          ? detail.join(', ')
          : detail || 'Không upload được giấy tờ',
      );
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = (document: EmployeeDocument) => {
    Modal.confirm({
      title: `Xóa giấy tờ “${document.name}”?`,
      okButtonProps: { danger: true },
      onOk: async () => {
        await api.delete(`${endpoint}/documents/${document.id}`);
        message.success('Đã xóa giấy tờ');
        await loadDocuments();
      },
    });
  };

  return (
    <>
      <Card
        title="Danh sách giấy tờ"
        extra={
          canEdit ? (
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => setDialogOpen(true)}
            >
              Upload giấy tờ
            </Button>
          ) : null
        }
      >
        <Table
          rowKey="id"
          dataSource={documents}
          pagination={false}
          locale={{ emptyText: 'Chưa có giấy tờ' }}
          columns={[
            {
              title: 'Loại giấy tờ',
              dataIndex: 'documentType',
              render: (value: EmployeeDocumentType) =>
                DOCUMENT_TYPE_OPTIONS.find((item) => item.value === value)
                  ?.label ?? value,
            },
            { title: 'Tên giấy tờ', dataIndex: 'name' },
            { title: 'Tên file', dataIndex: 'originalFileName' },
            {
              title: 'Dung lượng',
              dataIndex: 'size',
              render: (size: number) => `${(size / 1024 / 1024).toFixed(2)} MB`,
            },
            {
              title: 'Thao tác',
              render: (_, document: EmployeeDocument) => (
                <Space>
                  <Button
                    size="small"
                    icon={<DownloadOutlined />}
                    href={resolveAvatarSrc(document.fileUrl)}
                    target="_blank"
                  >
                    Xem
                  </Button>
                  {canEdit ? (
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => deleteDocument(document)}
                    >
                      Xóa
                    </Button>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="Upload giấy tờ"
        open={dialogOpen}
        okText="Upload"
        cancelText="Hủy"
        confirmLoading={uploading}
        onOk={() => void uploadDocument()}
        onCancel={() => {
          setDialogOpen(false);
          setFileList([]);
          form.resetFields();
        }}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="documentType"
            label="Loại giấy tờ"
            rules={[{ required: true, message: 'Chọn loại giấy tờ' }]}
          >
            <Select
              placeholder="Chọn loại giấy tờ"
              options={DOCUMENT_TYPE_OPTIONS}
            />
          </Form.Item>
          <Form.Item
            name="name"
            label="Tên giấy tờ"
            rules={[{ required: true, message: 'Nhập tên giấy tờ' }]}
          >
            <Input maxLength={255} />
          </Form.Item>
          <Form.Item label="File upload" required>
            <Upload
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              beforeUpload={() => false}
              maxCount={1}
              fileList={fileList}
              onChange={({ fileList: next }) => setFileList(next.slice(-1))}
            >
              <Button icon={<UploadOutlined />}>Chọn file upload</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
