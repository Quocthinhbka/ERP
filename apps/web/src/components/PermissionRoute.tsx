import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import type { PermissionCode } from '@erp/shared';
import { useAuth } from '../contexts/AuthContext';
import { PageSpinner } from './PageSpinner';

type PermissionRouteProps = {
  children: ReactNode;
  /** Một quyền bắt buộc. */
  permission?: PermissionCode;
  /** Nhiều quyền — mặc định chỉ cần một (any). */
  permissions?: PermissionCode[];
  requireAll?: boolean;
};

export function PermissionRoute({
  children,
  permission,
  permissions,
  requireAll = false,
}: PermissionRouteProps) {
  const { hasPermission, loading, user } = useAuth();

  if (loading) {
    return <PageSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const codes = permission ? [permission] : (permissions ?? []);
  if (codes.length === 0) {
    return <>{children}</>;
  }

  const allowed = requireAll
    ? codes.every((code) => hasPermission(code))
    : codes.some((code) => hasPermission(code));

  if (!allowed) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
}
