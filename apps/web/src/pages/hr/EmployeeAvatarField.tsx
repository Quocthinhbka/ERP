import { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Space, Upload, message } from 'antd';
import { DeleteOutlined, UserOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { api } from '../../lib/api';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

function resolveAvatarSrc(avatarUrl?: string | null) {
  if (!avatarUrl) return undefined;
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl;
  }
  // Cùng origin qua Vite proxy /uploads, hoặc absolute API nếu VITE_API_URL.
  const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  return `${apiBase}${avatarUrl}`;
}

interface Props {
  employeeId?: string;
  endpoint?: string;
  avatarUrl?: string | null;
  disabled?: boolean;
  onUploaded?: (avatarUrl: string | null) => void;
  /** File chọn trước khi hồ sơ được tạo; form cha sẽ upload sau khi tạo. */
  pendingFile?: File | null;
  onPendingFileChange?: (file: File | null) => void;
}

export function EmployeeAvatarField({
  employeeId,
  endpoint,
  avatarUrl,
  disabled,
  onUploaded,
  pendingFile,
  onPendingFileChange,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!pendingFile) {
      setObjectUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const previewUrl = useMemo(
    () => objectUrl ?? resolveAvatarSrc(avatarUrl),
    [objectUrl, avatarUrl],
  );

  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    if (!ACCEPTED.includes(file.type)) {
      message.error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP');
      return Upload.LIST_IGNORE;
    }
    if (file.size > MAX_BYTES) {
      message.error('Ảnh đại diện tối đa 2MB');
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const customRequest: UploadProps['customRequest'] = async (options) => {
    const file = options.file as File;
    const avatarEndpoint = endpoint ?? (employeeId ? `/employees/${employeeId}/avatar` : '');
    if (!avatarEndpoint) {
      onPendingFileChange?.(file);
      options.onSuccess?.({});
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const { data } = await api.post<{ avatarUrl: string | null }>(
        avatarEndpoint,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      onUploaded?.(data.avatarUrl ?? null);
      message.success('Đã cập nhật ảnh đại diện');
      options.onSuccess?.(data);
    } catch (error) {
      const detail =
        (error as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message;
      const text = Array.isArray(detail)
        ? detail.join(', ')
        : detail || 'Không tải được ảnh đại diện';
      message.error(text);
      options.onError?.(error as Error);
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    const avatarEndpoint = endpoint ?? (employeeId ? `/employees/${employeeId}/avatar` : '');
    if (!avatarEndpoint) {
      onPendingFileChange?.(null);
      return;
    }
    setUploading(true);
    try {
      await api.delete(avatarEndpoint);
      onUploaded?.(null);
      message.success('Đã xóa ảnh đại diện');
    } catch (error) {
      const detail =
        (error as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message;
      message.error(
        Array.isArray(detail)
          ? detail.join(', ')
          : detail || 'Không xóa được ảnh đại diện',
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <Space align="start" size="large">
      <Avatar size={96} src={previewUrl} icon={<UserOutlined />} />
      <Space direction="vertical">
        <Upload
          accept=".jpg,.jpeg,.png,.webp"
          showUploadList={false}
          disabled={disabled || uploading}
          beforeUpload={beforeUpload}
          customRequest={customRequest}
        >
          <Button loading={uploading} disabled={disabled}>
            {previewUrl ? 'Đổi ảnh đại diện' : 'Chọn ảnh đại diện'}
          </Button>
        </Upload>
        {previewUrl ? (
          <Button
            danger
            icon={<DeleteOutlined />}
            loading={uploading}
            disabled={disabled}
            onClick={() => void removeAvatar()}
          >
            Xóa ảnh
          </Button>
        ) : null}
        <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
          JPG/PNG/WebP, tối đa 2MB
        </span>
      </Space>
    </Space>
  );
}

export { resolveAvatarSrc };
