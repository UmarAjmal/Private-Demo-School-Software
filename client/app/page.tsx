'use client';
import { useAuth } from '@/contexts/AuthContext';
import AdminDashboard      from '@/components/dashboards/AdminDashboard';
import TeacherDashboard    from '@/components/dashboards/TeacherDashboard';
import AccountantDashboard from '@/components/dashboards/AccountantDashboard';
import StudentDashboard from '@/components/dashboards/StudentDashboard';
import GenericDashboard    from '@/components/dashboards/GenericDashboard';
import { DashLoading }     from '@/components/dashboards/shared';

export default function Dashboard() {
  const { user, isLoading } = useAuth();

  if (isLoading || !user) return <DashLoading />;

  const roleLevel = user.role_level || 0;
  const name = user.full_name || user.username || 'User';

  const roleName = (user.role_name || '').toLowerCase();
  const username = (user.username || '').toUpperCase();
  const isStudentOrFamily =
    user.dashboard_access === 'student' ||
    roleName.includes('student') ||
    roleName.includes('family') ||
    username.startsWith('STU-') ||
    username.startsWith('FAM-') ||
    (user.role_level !== undefined && user.role_level > 0 && user.role_level <= 15);

  if (isStudentOrFamily) {
    return <StudentDashboard key={`dashboard-${user.id}`} user={user} />;
  }

  // Determine dynamic assigned dashboard (fallback to legacy roleLevel)
  const dashAccess = user.dashboard_access || (
    roleLevel >= 90 ? 'admin' :
    roleLevel >= 50 ? 'teacher' :
    roleLevel >= 20 ? 'accountant' : 'student'
  );

  if (dashAccess === 'admin') {
    return <AdminDashboard userName={name} />;
  }
  if (dashAccess === 'teacher') {
    return <TeacherDashboard userId={user.id} />;
  }
  if (dashAccess === 'accountant') {
    return <AccountantDashboard userName={name} />;
  }
  if (dashAccess === 'student') {
    return <StudentDashboard key={`dashboard-${user.id}`} user={user} />;
  }

  return <GenericDashboard userName={name} role={user.role_name || 'Staff'} />;
}
