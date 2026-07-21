import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MainLayout } from './layouts/MainLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { RolesPage } from './pages/setup/RolesPage';
import { OrganizationPage } from './pages/setup/OrganizationPage';
import { AccountsPage } from './pages/setup/AccountsPage';
import { AccountDetailPage } from './pages/setup/AccountDetailPage';
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

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="setup/roles" element={<RolesPage />} />
            <Route path="setup/organization" element={<OrganizationPage />} />
            <Route path="setup/accounts" element={<AccountsPage />} />
            <Route path="setup/accounts/:id" element={<AccountDetailPage />} />
            <Route path="setup/permission-groups" element={<PermissionGroupsPage />} />
            <Route path="setup/permissions" element={<PermissionsPage />} />
            <Route path="setup/users" element={<Navigate to="/setup/accounts" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
