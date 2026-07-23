import type { AxiosError } from 'axios';

type ApiErrorBody = { message?: string | string[]; missing?: string[] };

/** Trích xuất thông báo lỗi từ phản hồi API hoặc Error. */
export function getApiErrorMessage(error: unknown, fallback = 'Thao tác thất bại'): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as AxiosError<ApiErrorBody>).response;
    const missing = response?.data?.missing;
    if (Array.isArray(missing) && missing.length) {
      return `Thiếu: ${missing.join(', ')}`;
    }
    const msg = response?.data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

/** Thông báo lỗi đăng nhập (429, 401, network). */
export function getLoginErrorMessage(error: unknown): string {
  const status =
    error && typeof error === 'object' && 'response' in error
      ? (error as AxiosError<ApiErrorBody>).response?.status
      : undefined;

  if (status === 429) {
    return 'Thử đăng nhập quá nhiều lần. Vui lòng đợi khoảng 1 phút rồi thử lại.';
  }
  if (status === 401) {
    return 'Thông tin đăng nhập hoặc mật khẩu không đúng';
  }

  const serverMessage = getApiErrorMessage(error, '');
  if (serverMessage) return serverMessage;

  return 'Không kết nối được máy chủ. Kiểm tra API đang chạy và thử lại.';
}
