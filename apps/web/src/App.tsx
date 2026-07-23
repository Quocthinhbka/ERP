import { lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router';
import { Permissions } from '@erp/shared';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PermissionRoute } from './components/PermissionRoute';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MainLayout } from './layouts/MainLayout';
import { LoginPage } from './pages/LoginPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { ForbiddenPage } from './pages/ForbiddenPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PersonalAccountPage } from './pages/personal/PersonalAccountPage';
import { PersonalProfileDetailPage } from './pages/personal/PersonalProfileDetailPage';
import { PersonalProfileFormPage } from './pages/personal/PersonalProfileFormPage';
import { HrEmployeeDetailPage } from './pages/hr/HrEmployeeDetailPage';
import { HrEmployeeFormPage } from './pages/hr/HrEmployeeFormPage';

const OrganizationPage = lazy(() =>
  import('./pages/setup/OrganizationPage').then((m) => ({ default: m.OrganizationPage })),
);
const EmployeeProfileFieldSettingsPage = lazy(() =>
  import('./pages/setup/EmployeeProfileFieldSettingsPage').then((m) => ({
    default: m.EmployeeProfileFieldSettingsPage,
  })),
);
const PermissionGroupsPage = lazy(() =>
  import('./pages/setup/PermissionGroupsPage').then((m) => ({ default: m.PermissionGroupsPage })),
);
const PermissionsPage = lazy(() =>
  import('./pages/setup/PermissionsPage').then((m) => ({ default: m.PermissionsPage })),
);
const AccountsPage = lazy(() =>
  import('./pages/hr/AccountsPage').then((m) => ({ default: m.AccountsPage })),
);
const AccountDetailPage = lazy(() =>
  import('./pages/hr/AccountDetailPage').then((m) => ({ default: m.AccountDetailPage })),
);
const EmployeesPage = lazy(() =>
  import('./pages/hr/EmployeesPage').then((m) => ({ default: m.EmployeesPage })),
);

function RedirectLegacyAccountDetail() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/hr/accounts/${id}`} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/forbidden" element={<ForbiddenPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ErrorBoundary>
                  <MainLayout />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="personal/profile" element={<PersonalProfileDetailPage />} />
            <Route path="personal/profile/edit" element={<PersonalProfileFormPage />} />
            <Route path="personal/account" element={<PersonalAccountPage />} />
            <Route
              path="hr/accounts"
              element={
                <PermissionRoute permission={Permissions.USER_VIEW}>
                  <AccountsPage />
                </PermissionRoute>
              }
            />
            <Route
              path="hr/accounts/:id"
              element={
                <PermissionRoute permission={Permissions.USER_VIEW}>
                  <AccountDetailPage />
                </PermissionRoute>
              }
            />
            <Route
              path="hr/employees"
              element={
                <PermissionRoute permissions={[Permissions.HR_EMPLOYEE_VIEW, Permissions.HR_VIEW]}>
                  <EmployeesPage />
                </PermissionRoute>
              }
            />
            <Route
              path="hr/employees/new"
              element={
                <PermissionRoute permission={Permissions.HR_EMPLOYEE_CREATE}>
                  <HrEmployeeFormPage />
                </PermissionRoute>
              }
            />
            <Route
              path="hr/employees/:id"
              element={
                <PermissionRoute permissions={[Permissions.HR_EMPLOYEE_VIEW, Permissions.HR_VIEW]}>
                  <HrEmployeeDetailPage />
                </PermissionRoute>
              }
            />
            <Route
              path="hr/employees/:id/edit"
              element={
                <PermissionRoute permission={Permissions.HR_EMPLOYEE_UPDATE}>
                  <HrEmployeeFormPage />
                </PermissionRoute>
              }
            />
            <Route
              path="setup/organization"
              element={
                <PermissionRoute permission={Permissions.ORGANIZATION_VIEW}>
                  <OrganizationPage />
                </PermissionRoute>
              }
            />
            <Route
              path="setup/hr/profile-fields"
              element={
                <PermissionRoute permissions={[Permissions.SETUP_VIEW, Permissions.SETUP_MANAGE]}>
                  <EmployeeProfileFieldSettingsPage />
                </PermissionRoute>
              }
            />
            <Route
              path="setup/permission-groups"
              element={
                <PermissionRoute permission={Permissions.PERMISSION_GROUP_VIEW}>
                  <PermissionGroupsPage />
                </PermissionRoute>
              }
            />
            <Route
              path="setup/permissions"
              element={
                <PermissionRoute permission={Permissions.PERMISSION_VIEW}>
                  <PermissionsPage />
                </PermissionRoute>
              }
            />
            <Route path="setup/roles" element={<Navigate to="/setup/permission-groups" replace />} />
            <Route path="setup/accounts" element={<Navigate to="/hr/accounts" replace />} />
            <Route path="setup/accounts/:id" element={<RedirectLegacyAccountDetail />} />
            <Route path="setup/users" element={<Navigate to="/hr/accounts" replace />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
