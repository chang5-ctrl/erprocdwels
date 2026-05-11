import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activity';

type StaffOption = { user_id: string; full_name: string | null };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export default function ProjectDialog({ open, onOpenChange, onCreated }: Props) {
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    customer_name: '',
    location: '',
    budget_total: '',
    start_date: '',
    expected_end_date: '',
    project_manager_id: '',
    description: '',
  });

  useEffect(() => {
    if (!open) return;
    supabase
      .from('user_profiles')
      .select('user_id, full_name')
      .eq('is_active', true)
      .order('full_name')
      .then(({ data }) => setStaff((data ?? []) as StaffOption[]));
    setForm({
      name: '', customer_name: '', location: '', budget_total: '',
      start_date: '', expected_end_date: '', project_manager_id: '', description: '',
    });
  }, [open]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Project name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        customer_name: form.customer_name || null,
        location: form.location || null,
        description: form.description || null,
        budget_total: form.budget_total ? Number(form.budget_total) : 0,
        start_date: form.start_date || null,
        expected_end_date: form.expected_end_date || null,
        project_manager_id: form.project_manager_id || null,
        status: 'active',
      };
      const { data, error } = await supabase.from('projects').insert(payload).select('id').single();
      if (error) throw error;
      await logActivity('project', 'created', data.id, { name: payload.name });
      toast.success('Project created');
      onOpenChange(false);
      onCreated?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Project Name *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Client</Label>
            <Input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Contract Value (₦)</Label>
            <Input type="number" min="0" step="0.01" value={form.budget_total} onChange={e => setForm(f => ({ ...f, budget_total: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Project Manager</Label>
            <Select value={form.project_manager_id} onValueChange={v => setForm(f => ({ ...f, project_manager_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
              <SelectContent>
                {staff.map(s => (
                  <SelectItem key={s.user_id} value={s.user_id}>{s.full_name || 'Unnamed'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Expected End Date</Label>
            <Input type="date" value={form.expected_end_date} onChange={e => setForm(f => ({ ...f, expected_end_date: e.target.value }))} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Description</Label>
            <Textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Create Project'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
