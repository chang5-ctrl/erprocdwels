import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function RoleHome() {
  const { loading, user, roles } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (roles.includes('admin')) return <Navigate to="/admin" replace />;
  if (roles.includes('project_manager')) return <Navigate to="/dashboard/pm" replace />;
  if (roles.includes('accountant')) return <Navigate to="/dashboard/accounts" replace />;
  if (roles.includes('procurement_officer')) return <Navigate to="/dashboard/procurement" replace />;
  if (roles.includes('site_manager')) return <Navigate to="/dashboard/site" replace />;
  return <Navigate to="/projects" replace />;
}
