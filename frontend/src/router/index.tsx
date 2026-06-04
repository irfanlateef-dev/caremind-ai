import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';
import { RoleGuard } from '@/components/shared/RoleGuard';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { UserRole } from '@/types';

// Auth pages
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';

// Dashboard
import { DashboardPage } from '@/features/dashboard/DashboardPage';

// Appointments
import { AppointmentsPage } from '@/features/appointments/AppointmentsPage';
import { AppointmentDetailPage } from '@/features/appointments/AppointmentDetailPage';
import { ConsultationRoomPage } from '@/features/consultations/ConsultationRoomPage';

// Documents
import { DocumentsPage } from '@/features/documents/DocumentsPage';

// AI
import { AiAssistantPage } from '@/features/ai-assistant/AiAssistantPage';
import { AiOutputsPage } from '@/features/ai-outputs/AiOutputsPage';
import { AiOutputDetailPage } from '@/features/ai-outputs/AiOutputDetailPage';

// Users
import { UsersPage } from '@/features/users/UsersPage';
import { PatientsPage } from '@/features/patients/PatientsPage';
import { PatientDetailPage } from '@/features/patients/PatientDetailPage';

// Admin
import { AuditLogsPage } from '@/features/admin/AuditLogsPage';

// Profile
import { ProfilePage } from '@/features/auth/ProfilePage';

// Root redirect
import { RoleRedirect } from './RoleRedirect';

export const router = createBrowserRouter([
  {
    path: '/',
    errorElement: <ErrorBoundary><div /></ErrorBoundary>,
    children: [
      { index: true, element: <RoleRedirect /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      {
        element: (
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        ),
        children: [
          { path: 'dashboard', element: <DashboardPage /> },
          {
            path: 'patients',
            element: (
              <RoleGuard allowedRoles={[UserRole.DOCTOR]}>
                <PatientsPage />
              </RoleGuard>
            ),
          },
          {
            path: 'patients/:id',
            element: (
              <RoleGuard allowedRoles={[UserRole.DOCTOR]}>
                <PatientDetailPage />
              </RoleGuard>
            ),
          },
          { path: 'appointments', element: <AppointmentsPage /> },
          { path: 'appointments/:id', element: <AppointmentDetailPage /> },
          {
            path: 'documents',
            element: (
              <RoleGuard allowedRoles={[UserRole.DOCTOR, UserRole.PATIENT]}>
                <DocumentsPage />
              </RoleGuard>
            ),
          },
          {
            path: 'ai-assistant',
            element: (
              <RoleGuard allowedRoles={[UserRole.DOCTOR, UserRole.PATIENT]}>
                <AiAssistantPage />
              </RoleGuard>
            ),
          },
          {
            path: 'ai-outputs',
            element: (
              <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.DOCTOR]}>
                <AiOutputsPage />
              </RoleGuard>
            ),
          },
          {
            path: 'ai-outputs/:appointmentId',
            element: (
              <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.DOCTOR]}>
                <AiOutputDetailPage />
              </RoleGuard>
            ),
          },
          {
            path: 'users',
            element: (
              <RoleGuard allowedRoles={[UserRole.ADMIN]}>
                <UsersPage />
              </RoleGuard>
            ),
          },
          {
            path: 'admin/dashboard',
            element: <Navigate to="/dashboard" replace />,
          },
          {
            path: 'admin/audit-logs',
            element: (
              <RoleGuard allowedRoles={[UserRole.ADMIN]}>
                <AuditLogsPage />
              </RoleGuard>
            ),
          },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
      {
        path: 'appointments/:id/consultation',
        element: (
          <ProtectedRoute>
            <ConsultationRoomPage />
          </ProtectedRoute>
        ),
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
