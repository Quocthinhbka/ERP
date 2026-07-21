import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MainLayout } from './layouts/MainLayout';
import { LoginPage } from './pages/LoginPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { RolesPage } from './pages/setup/RolesPage';
import { OrganizationPage } from './pages/setup/OrganizationPage';
import { AccountsPage } from './pages/hr/AccountsPage';
import { AccountDetailPage } from './pages/hr/AccountDetailPage';
import { EmployeesPage } from './pages/hr/EmployeesPage';
import { EmployeeFormPage } from './pages/hr/EmployeeFormPage';
import { EmployeeDetailPage } from './pages/hr/EmployeeDetailPage';
import { PermissionGroupsPage } from './pages/setup/PermissionGroupsPage';
import { PermissionsPage } from './pages/setup/PermissionsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
}

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
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="hr/accounts" element={<AccountsPage />} />
            <Route path="hr/accounts/:id" element={<AccountDetailPage />} />
            <Route path="hr/employees" element={<EmployeesPage />} />
            <Route path="hr/employees/new" element={<EmployeeFormPage />} />
            <Route
              path="hr/employees/:id"
              element={<EmployeeDetailPage />}
            />
            <Route
              path="hr/employees/:id/edit"
              element={<EmployeeFormPage />}
            />
            <Route path="setup/roles" element={<RolesPage />} />
            <Route path="setup/organization" element={<OrganizationPage />} />
            <Route path="setup/permission-groups" element={<PermissionGroupsPage />} />
            <Route path="setup/permissions" element={<PermissionsPage />} />
            {/* Redirect URL cũ */}
            <Route path="setup/accounts" element={<Navigate to="/hr/accounts" replace />} />
            <Route path="setup/accounts/:id" element={<RedirectLegacyAccountDetail />} />
            <Route path="setup/users" element={<Navigate to="/hr/accounts" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
