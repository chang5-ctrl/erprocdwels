import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { roleLabels, roleColors } from '@/lib/activity';
import type { Database } from '@/integrations/supabase/types';
import StaffCreateDialog from '@/pages/admin/StaffCreateDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

type AppRole = Database['public']['Enums']['app_role'];

interface StaffRow {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  job_title: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  role: AppRole | null;
}

const ROLES: AppRole[] = ['admin', 'site_manager', 'procurement_officer', 'accountant'];

export default function StaffList() {
  const { hasRole, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from('user_profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('user_id, role'),
    ]);
    const roleMap = new Map((roles ?? []).map(r => [r.user_id, r.role as AppRole]));
    setRows((profiles ?? []).map(p => ({
      user_id: p.user_id,
      full_name: p.full_name,
      phone: p.phone,
      job_title: p.job_title,
      is_active: p.is_active,
      last_login_at: p.last_login_at,
      created_at: p.created_at,
      role: roleMap.get(p.user_id) ?? null,
    })));
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading || !hasRole('admin')) return;
    load();
  }, [authLoading, hasRole]);

  const updateRole = async (userId: string, newRole: AppRole) => {
    await supabase.from('user_roles').delete().eq('user_id', userId);
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: newRole });
    if (error) { toast.error(error.message); return; }
    toast.success('Role updated');
    await supabase.from('activity_logs').insert({
      entity_type: 'user', entity_id: userId, action: 'role_changed', details: { new_role: newRole },
    });
    load();
  };

  if (authLoading) return null;
  if (!hasRole('admin')) return <Navigate to="/projects" replace />;

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Staff</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add Staff
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          No staff yet. Click "Add Staff" to create the first account.
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Job Title</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.user_id}>
                  <TableCell className="font-medium">{r.full_name || '—'}</TableCell>
                  <TableCell>{r.job_title || '—'}</TableCell>
                  <TableCell>
                    <Select value={r.role ?? ''} onValueChange={v => updateRole(r.user_id, v as AppRole)}>
                      <SelectTrigger className="w-[170px] h-8">
                        <SelectValue placeholder="No role">
                          {r.role && <Badge variant="secondary" className={roleColors[r.role]}>{roleLabels[r.role]}</Badge>}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map(role => (
                          <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{r.phone || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={r.is_active ? 'default' : 'secondary'}>
                      {r.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDate(r.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <StaffCreateDialog open={open} onOpenChange={setOpen} onCreated={load} />
    </div>
  );
}
