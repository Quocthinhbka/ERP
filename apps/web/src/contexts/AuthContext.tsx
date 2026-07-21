import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { OrgScopeNode, PermissionCode } from '@erp/shared';
import { api, setMemoryAccessToken } from '../lib/api';

interface AuthUser {
  id: string;
  email: string | null;
  fullName?: string;
  mustChangePassword: boolean;
  permissions: PermissionCode[];
  isSystemAdmin?: boolean;
  orgScopes?: OrgScopeNode[];
}

export interface LoginCredentials {
  identifier: string;
  password: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthUser>;
  changePassword: (values: {
    currentPassword: string;
    newPassword: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: PermissionCode) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get<AuthUser>('/auth/me');
      setUser(data);
    } catch {
      setMemoryAccessToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const { data } = await api.post('/auth/login', credentials);
    if (!data?.user || !data?.accessToken) {
      throw new Error('Phản hồi đăng nhập không hợp lệ');
    }
    setMemoryAccessToken(data.accessToken);
    setUser(data.user);
    return data.user as AuthUser;
  }, []);

  const changePassword = useCallback(
    async (values: { currentPassword: string; newPassword: string }) => {
      const { data } = await api.post('/auth/change-password', values);
      if (!data?.user || !data?.accessToken) {
        throw new Error('Phản hồi đổi mật khẩu không hợp lệ');
      }
      setMemoryAccessToken(data.accessToken);
      setUser(data.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // Cookie có thể đã hết hạn — vẫn xóa state local.
    }
    setMemoryAccessToken(null);
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (permission: PermissionCode) =>
      user?.isSystemAdmin === true ||
      (user?.permissions.includes(permission) ?? false),
    [user],
  );

  const value = useMemo(
    () => ({ user, loading, login, changePassword, logout, hasPermission }),
    [user, loading, login, changePassword, logout, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
