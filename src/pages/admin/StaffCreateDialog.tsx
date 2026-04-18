import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { roleLabels } from '@/lib/activity';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];
const ROLES: AppRole[] = ['admin', 'site_manager', 'procurement_officer', 'accountant'];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz';
  let p = '';
  for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p + '!';
};

export default function StaffCreateDialog({ open, onOpenChange, onCreated }: Props) {
  const [form, setForm] = useState({
    email: '', full_name: '', phone: '', job_title: '',
    role: 'site_manager' as AppRole, password: generatePassword(),
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.email.trim() || !form.full_name.trim()) {
      toast.error('Name and email are required');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: form,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Staff created. Temp password: ${form.password}`, { duration: 15000 });
      onCreated();
      onOpenChange(false);
      setForm({ email: '', full_name: '', phone: '', job_title: '', role: 'site_manager', password: generatePassword() });
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to create staff');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Full Name *</Label>
            <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Job Title</Label>
              <Input value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Role *</Label>
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as AppRole }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map(r => <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Temporary Password</Label>
            <div className="flex gap-2">
              <Input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              <Button type="button" variant="outline" onClick={() => setForm(f => ({ ...f, password: generatePassword() }))}>
                Regenerate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Share this with the user. They can change it after first login.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Creating…' : 'Create Staff'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
