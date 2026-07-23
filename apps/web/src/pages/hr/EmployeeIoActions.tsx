import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Modal,
  Radio,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  DownloadOutlined,
  FileExcelOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../../lib/api';

type DiffKind = 'new' | 'changed' | 'unchanged' | 'missing_in_file';
type IoFormat = 'excel' | 'json';

interface DiffChangeItem {
  selectionKey: string;
  entityType: string;
  entityId: string;
  kind: DiffKind;
  label: string;
  warning?: string;
  selectable: boolean;
  profileCode?: string;
  fieldDiffs?: Array<{ field: string; current: unknown; incoming: unknown }>;
}

interface DiffResult {
  changes: DiffChangeItem[];
  errors: string[];
  stats: {
    new: number;
    changed: number;
    unchanged: number;
    missingInFile: number;
  };
}

interface JobResponse {
  jobId: string;
  status: string;
  result?: {
    success?: boolean;
    fileName?: string;
    hasSnapshot?: boolean;
    hasFile?: boolean;
    diff?: DiffResult;
    applied?: { created: number; updated: number; deleted: number };
    errors?: string[];
  } | null;
  failedReason?: string | null;
}

async function waitForJob(jobId: string, timeoutMs = 90000): Promise<JobResponse> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { data } = await api.get<JobResponse>(`/employees/io/jobs/${jobId}`);
    if (data.status === 'completed' || data.status === 'failed') {
      return data;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Job timeout');
}

function kindTag(kind: DiffKind) {
  switch (kind) {
    case 'new':
      return <Tag color="green">Mới</Tag>;
    case 'changed':
      return <Tag color="gold">Khác</Tag>;
    case 'missing_in_file':
      return <Tag color="default">Chỉ có trên hệ thống</Tag>;
    default:
      return <Tag>Giống</Tag>;
  }
}

function rowStyle(kind: DiffKind): React.CSSProperties {
  switch (kind) {
    case 'new':
      return { background: '#f6ffed' };
    case 'changed':
      return { background: '#fffbe6' };
    case 'missing_in_file':
      return { background: '#fafafa' };
    default:
      return {};
  }
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function downloadMime(fileName: string) {
  return fileName.toLowerCase().endsWith('.json')
    ? 'application/json'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

interface Props {
  canExport: boolean;
  canImport: boolean;
  onApplied: () => Promise<void> | void;
}

export function EmployeeIoActions({ canExport, canImport, onApplied }: Props) {
  const [diffOpen, setDiffOpen] = useState(false);
  const [formatOpen, setFormatOpen] = useState<'export' | 'template' | 'import' | null>(
    null,
  );
  const [format, setFormat] = useState<IoFormat>('excel');
  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [snapshotJobId, setSnapshotJobId] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visibleRows = useMemo(
    () => (diff?.changes ?? []).filter((item) => item.kind !== 'unchanged'),
    [diff],
  );

  const selectableKeys = useMemo(
    () => visibleRows.filter((item) => item.selectable).map((item) => item.selectionKey),
    [visibleRows],
  );

  const downloadBlob = async (jobId: string, fileName: string) => {
    const response = await api.get(`/employees/io/jobs/${jobId}/download`, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: downloadMime(fileName) });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async (selectedFormat: IoFormat, template = false) => {
    setLoading(true);
    try {
      const { data } = await api.post<{ jobId: string }>(
        '/employees/io/export',
        { format: selectedFormat },
        { params: template ? { template: 1 } : undefined },
      );
      const job = await waitForJob(data.jobId);
      if (job.status !== 'completed') {
        throw new Error(job.failedReason || 'Export thất bại');
      }
      const ext = selectedFormat === 'json' ? 'json' : 'xlsx';
      await downloadBlob(
        data.jobId,
        job.result?.fileName ??
          (template ? `employee-template.${ext}` : `employee-export.${ext}`),
      );
      message.success(
        template
          ? `Đã tải file mẫu ${selectedFormat === 'json' ? 'JSON' : 'Excel'}`
          : `Đã xuất ${selectedFormat === 'json' ? 'JSON' : 'Excel'} hồ sơ`,
      );
    } catch (error) {
      const detail =
        (error as { response?: { data?: { message?: string | string[] } } })?.response
          ?.data?.message;
      const text = Array.isArray(detail)
        ? detail.join(', ')
        : detail || (error instanceof Error ? error.message : 'Export thất bại');
      message.error(text);
    } finally {
      setLoading(false);
    }
  };

  const handleImportFile = async (file: File) => {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.json')) {
      message.error('Chỉ hỗ trợ file .xlsx hoặc .json');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post<{ jobId: string }>(
        '/employees/io/import/diff',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      const job = await waitForJob(data.jobId);
      if (job.status !== 'completed' || !job.result?.diff || !job.result.hasSnapshot) {
        throw new Error(job.failedReason || 'So sánh import thất bại');
      }
      setDiff(job.result.diff);
      setSnapshotJobId(data.jobId);
      setSelectedKeys([]);
      setDiffOpen(true);
      message.success('Đã tạo bảng so sánh trước/sau');
    } catch (error) {
      const detail =
        (error as { response?: { data?: { message?: string | string[] } } })?.response
          ?.data?.message;
      const text = Array.isArray(detail)
        ? detail.join(', ')
        : detail || (error instanceof Error ? error.message : 'Import thất bại');
      message.error(text);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!snapshotJobId) return;
    if (selectedKeys.length === 0) {
      message.warning('Chưa chọn nội dung cập nhật');
      return;
    }

    Modal.confirm({
      title: 'Áp dụng thay đổi đã chọn?',
      content: `Sẽ áp dụng ${selectedKeys.length} mục. Dữ liệu chỉ có trên hệ thống sẽ không bị xóa.`,
      okText: 'Áp dụng',
      cancelText: 'Hủy',
      onOk: async () => {
        setLoading(true);
        try {
          const { data } = await api.post<{ jobId: string }>(
            '/employees/io/import/apply',
            {
              snapshotJobId,
              selections: selectedKeys.map((selectionKey) => ({ selectionKey })),
            },
          );
          const job = await waitForJob(data.jobId);
          if (job.status !== 'completed') {
            throw new Error(job.failedReason || 'Áp dụng thất bại');
          }
          const applied = job.result?.applied;
          message.success(
            `Đã áp dụng: +${applied?.created ?? 0} mới / ~${applied?.updated ?? 0} cập nhật`,
          );
          if (job.result?.errors?.length) {
            message.warning(job.result.errors.slice(0, 3).join('; '));
          }
          setDiffOpen(false);
          setDiff(null);
          setSnapshotJobId(null);
          setSelectedKeys([]);
          await onApplied();
        } catch (error) {
          message.error(error instanceof Error ? error.message : 'Áp dụng thất bại');
          throw error;
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const confirmFormat = async () => {
    const mode = formatOpen;
    setFormatOpen(null);
    if (mode === 'export') {
      await handleExport(format, false);
      return;
    }
    if (mode === 'template') {
      await handleExport(format, true);
      return;
    }
    if (mode === 'import' && fileInputRef.current) {
      fileInputRef.current.accept =
        format === 'json' ? '.json,application/json' : '.xlsx';
      fileInputRef.current.click();
    }
  };

  const columns: ColumnsType<DiffChangeItem> = [
    {
      title: 'Loại',
      dataIndex: 'kind',
      width: 150,
      render: (kind: DiffKind) => kindTag(kind),
    },
    {
      title: 'Nội dung',
      dataIndex: 'label',
      render: (_value, row) => (
        <Space direction="vertical" size={2}>
          <Typography.Text>{row.label}</Typography.Text>
          {row.warning ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {row.warning}
            </Typography.Text>
          ) : null}
          {row.fieldDiffs?.length ? (
            <Space direction="vertical" size={0}>
              {row.fieldDiffs.map((field) => (
                <Typography.Text key={field.field} style={{ fontSize: 12 }}>
                  <Typography.Text type="secondary">{field.field}: </Typography.Text>
                  <Typography.Text delete type="danger">
                    {formatValue(field.current)}
                  </Typography.Text>
                  {' → '}
                  <Typography.Text type="success">
                    {formatValue(field.incoming)}
                  </Typography.Text>
                </Typography.Text>
              ))}
            </Space>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <>
      {canExport ? (
        <>
          <Button
            icon={<DownloadOutlined />}
            loading={loading}
            onClick={() => {
              setFormat('excel');
              setFormatOpen('export');
            }}
          >
            Xuất hồ sơ
          </Button>
          <Button
            icon={<FileExcelOutlined />}
            loading={loading}
            onClick={() => {
              setFormat('excel');
              setFormatOpen('template');
            }}
          >
            Tải file mẫu
          </Button>
        </>
      ) : null}
      {canImport ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.json"
            style={{ display: 'none' }}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) await handleImportFile(file);
            }}
          />
          <Button
            icon={<UploadOutlined />}
            loading={loading}
            onClick={() => {
              setFormat('excel');
              setFormatOpen('import');
            }}
          >
            Nhập hồ sơ
          </Button>
        </>
      ) : null}

      <Modal
        title={
          formatOpen === 'import'
            ? 'Chọn định dạng Import'
            : formatOpen === 'template'
              ? 'Chọn định dạng file mẫu'
              : 'Chọn định dạng Export'
        }
        open={formatOpen !== null}
        onCancel={() => setFormatOpen(null)}
        onOk={() => void confirmFormat()}
        okText="Tiếp tục"
        cancelText="Hủy"
        confirmLoading={loading}
        destroyOnHidden
      >
        <Radio.Group
          value={format}
          onChange={(e) => setFormat(e.target.value as IoFormat)}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <Radio value="excel">Excel (.xlsx)</Radio>
          <Radio value="json">JSON (.json)</Radio>
        </Radio.Group>
      </Modal>

      <Modal
        title="So sánh Import hồ sơ nhân sự"
        open={diffOpen}
        onCancel={() => setDiffOpen(false)}
        width={1100}
        okText="Áp dụng đã chọn"
        cancelText="Đóng"
        onOk={() => void handleApply()}
        confirmLoading={loading}
        destroyOnHidden
      >
        {diff ? (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Alert
              type="info"
              showIcon
              message={`Mới: ${diff.stats.new} · Khác: ${diff.stats.changed} · Giống: ${diff.stats.unchanged} · Chỉ có trên hệ thống: ${diff.stats.missingInFile}`}
              description="Chỉ áp dụng mục đã tích chọn. Mục 'Chỉ có trên hệ thống' chỉ để đối chiếu và không thể xóa qua import."
            />
            {diff.errors.length > 0 ? (
              <Alert
                type="warning"
                showIcon
                message={diff.errors.slice(0, 5).join('; ')}
              />
            ) : null}
            <Space>
              <Button
                size="small"
                onClick={() => setSelectedKeys(selectableKeys)}
                disabled={selectableKeys.length === 0}
              >
                Chọn tất cả có thể áp dụng
              </Button>
              <Button size="small" onClick={() => setSelectedKeys([])}>
                Bỏ chọn
              </Button>
            </Space>
            <Table
              size="small"
              rowKey="selectionKey"
              columns={columns}
              dataSource={visibleRows}
              pagination={{ pageSize: 10 }}
              onRow={(row) => ({ style: rowStyle(row.kind) })}
              rowSelection={{
                selectedRowKeys: selectedKeys,
                onChange: (keys) => setSelectedKeys(keys.map(String)),
                getCheckboxProps: (row) => ({
                  disabled: !row.selectable,
                }),
              }}
            />
          </Space>
        ) : null}
      </Modal>
    </>
  );
}
