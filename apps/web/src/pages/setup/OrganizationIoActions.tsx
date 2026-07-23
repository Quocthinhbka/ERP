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

async function waitForJob(jobId: string, timeoutMs = 60000): Promise<JobResponse> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { data } = await api.get<JobResponse>(`/organization/io/jobs/${jobId}`);
    if (data.status === 'completed' || data.status === 'failed') {
      return data;
    }
    await new Promise((r) => setTimeout(r, 400));
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
      return <Tag color="red">Chỉ có trên hệ thống</Tag>;
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
      return { background: '#fff2f0' };
    default:
      return {};
  }
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

export function OrganizationIoActions({ canExport, canImport, onApplied }: Props) {
  const [diffOpen, setDiffOpen] = useState(false);
  const [formatOpen, setFormatOpen] = useState<'export' | 'import' | null>(null);
  const [format, setFormat] = useState<IoFormat>('excel');
  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [snapshotJobId, setSnapshotJobId] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const actionableRows = useMemo(
    () => (diff?.changes ?? []).filter((c) => c.kind !== 'unchanged'),
    [diff],
  );

  const handleExport = async (selectedFormat: IoFormat) => {
    setLoading(true);
    try {
      const { data } = await api.post<{ jobId: string }>('/organization/export', {
        format: selectedFormat,
      });
      const job = await waitForJob(data.jobId);
      if (job.status !== 'completed') {
        throw new Error(job.failedReason || 'Export thất bại');
      }
      const fileName = job.result?.fileName ?? `organization-export.${selectedFormat === 'json' ? 'json' : 'xlsx'}`;
      const response = await api.get(`/organization/io/jobs/${data.jobId}/download`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: downloadMime(fileName) });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      message.success(`Đã export ${selectedFormat === 'json' ? 'JSON' : 'Excel'}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Export thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleImportFile = async (file: File) => {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.json')) {
      message.error('Chỉ hỗ trợ file .xlsx hoặc .json');
      return false;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post<{ jobId: string }>('/organization/import/diff', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const job = await waitForJob(data.jobId);
      if (job.status !== 'completed' || !job.result?.diff || !job.result.hasSnapshot) {
        throw new Error(job.failedReason || 'So sánh import thất bại');
      }
      setDiff(job.result.diff);
      setSnapshotJobId(data.jobId);
      setSelectedKeys([]);
      setDiffOpen(true);
      message.success('Đã tạo bảng so sánh');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Import thất bại');
    } finally {
      setLoading(false);
    }
    return false;
  };

  const handleApply = async () => {
    if (!snapshotJobId) return;
    if (selectedKeys.length === 0) {
      message.warning('Chưa chọn nội dung cập nhật');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post<{ jobId: string }>('/organization/import/apply', {
        snapshotJobId,
        selections: selectedKeys.map((selectionKey) => ({ selectionKey })),
      });
      const job = await waitForJob(data.jobId);
      if (job.status !== 'completed') {
        throw new Error(job.failedReason || 'Áp dụng thất bại');
      }
      const applied = job.result?.applied;
      message.success(
        `Đã áp dụng: +${applied?.created ?? 0} / ~${applied?.updated ?? 0} / -${applied?.deleted ?? 0}`,
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
    } finally {
      setLoading(false);
    }
  };

  const confirmFormat = async () => {
    const mode = formatOpen;
    setFormatOpen(null);
    if (mode === 'export') {
      await handleExport(format);
      return;
    }
    if (mode === 'import' && fileInputRef.current) {
      fileInputRef.current.accept = format === 'json' ? '.json,application/json' : '.xlsx';
      fileInputRef.current.click();
    }
  };

  const columns: ColumnsType<DiffChangeItem> = [
    {
      title: 'Loại',
      dataIndex: 'kind',
      width: 160,
      render: (kind: DiffKind) => kindTag(kind),
    },
    {
      title: 'Nội dung',
      dataIndex: 'label',
      render: (_: string, row) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{row.label}</Typography.Text>
          {row.warning && (
            <Typography.Text type="danger" style={{ fontSize: 12 }}>
              {row.warning}
            </Typography.Text>
          )}
          {row.fieldDiffs?.length ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Khác: {row.fieldDiffs.map((f) => f.field).join(', ')}
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <>
      {canExport && (
        <Button
          icon={<DownloadOutlined />}
          loading={loading}
          onClick={() => {
            setFormat('excel');
            setFormatOpen('export');
          }}
        >
          Export
        </Button>
      )}
      {canImport && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.json"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
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
            Import
          </Button>
        </>
      )}

      <Modal
        title={formatOpen === 'import' ? 'Chọn định dạng Import' : 'Chọn định dạng Export'}
        open={formatOpen !== null}
        onCancel={() => setFormatOpen(null)}
        onOk={confirmFormat}
        okText="Tiếp tục"
        cancelText="Hủy"
        confirmLoading={loading}
        destroyOnClose
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
        title="So sánh Import Tổ chức"
        open={diffOpen}
        onCancel={() => setDiffOpen(false)}
        width={960}
        okText="Áp dụng đã chọn"
        cancelText="Đóng"
        onOk={handleApply}
        confirmLoading={loading}
        destroyOnClose
      >
        {diff && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Alert
              type="info"
              showIcon
              message={`Mới: ${diff.stats.new} · Khác: ${diff.stats.changed} · Giống: ${diff.stats.unchanged} · Chỉ có trên hệ thống: ${diff.stats.missingInFile}`}
              description="Mặc định không tích chọn. Mục 'Chỉ có trên hệ thống' nếu tích sẽ bị XÓA."
            />
            <Table
              size="small"
              rowKey="selectionKey"
              columns={columns}
              dataSource={actionableRows}
              pagination={{ pageSize: 10 }}
              onRow={(row) => ({ style: rowStyle(row.kind) })}
              rowSelection={{
                selectedRowKeys: selectedKeys,
                onChange: (keys) => setSelectedKeys(keys.map(String)),
              }}
            />
          </Space>
        )}
      </Modal>
    </>
  );
}
