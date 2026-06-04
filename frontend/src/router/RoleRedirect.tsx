import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@/types';

export function RoleRedirect() {
  const { isAuthenticated, role } = useAuthStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (role === UserRole.ADMIN) return <Navigate to="/dashboard" replace />;
  return <Navigate to="/dashboard" replace />;
}
