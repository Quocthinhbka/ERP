import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Modal,
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
    snapshotPath?: string;
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

interface Props {
  canExport: boolean;
  canImport: boolean;
  onApplied: () => Promise<void> | void;
}

export function OrganizationIoActions({ canExport, canImport, onApplied }: Props) {
  const [diffOpen, setDiffOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [snapshotPath, setSnapshotPath] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const actionableRows = useMemo(
    () => (diff?.changes ?? []).filter((c) => c.kind !== 'unchanged'),
    [diff],
  );

  const handleExport = async () => {
    setLoading(true);
    try {
      const { data } = await api.post<{ jobId: string }>('/organization/export');
      const job = await waitForJob(data.jobId);
      if (job.status !== 'completed') {
        throw new Error(job.failedReason || 'Export thất bại');
      }
      const response = await api.get(`/organization/io/jobs/${data.jobId}/download`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = job.result?.fileName ?? 'organization-export.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      message.success('Đã export Excel');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Export thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleImportFile = async (file: File) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post<{ jobId: string }>('/organization/import/diff', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const job = await waitForJob(data.jobId);
      if (job.status !== 'completed' || !job.result?.diff || !job.result.snapshotPath) {
        throw new Error(job.failedReason || 'So sánh import thất bại');
      }
      setDiff(job.result.diff);
      setSnapshotPath(job.result.snapshotPath);
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
    if (!snapshotPath) return;
    if (selectedKeys.length === 0) {
      message.warning('Chưa chọn nội dung cập nhật');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post<{ jobId: string }>('/organization/import/apply', {
        snapshotPath,
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
      setSnapshotPath(null);
      setSelectedKeys([]);
      await onApplied();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Áp dụng thất bại');
    } finally {
      setLoading(false);
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
        <Button icon={<DownloadOutlined />} loading={loading} onClick={handleExport}>
          Export Excel
        </Button>
      )}
      {canImport && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
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
            onClick={() => fileInputRef.current?.click()}
          >
            Import Excel
          </Button>
        </>
      )}

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
