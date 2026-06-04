import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';

const TYPES = ['Design','Foundation','Substructure','Superstructure','Roofing','Finishing','MEP','External Works','Commissioning','Handover','Other'];
const STATUSES = ['not_started','in_progress','delayed','completed','on_hold'];

export default function MilestoneDialog({ open, onOpenChange, projectId, milestone, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  projectId?: string; milestone?: any; onSaved?: () => void;
}) {
  const [form, setForm] = useState<any>({});
  const [projects, setProjects] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    setForm(milestone || { project_id: projectId, status: 'not_started', pct_complete: 0, dependencies: [] });
    supabase.from('projects').select('id, name').order('name').then(({ data }) => setProjects(data ?? []));
    supabase.from('user_profiles').select('user_id, full_name').eq('is_active', true).then(({ data }) => setStaff(data ?? []));
    (supabase as any).from('milestones').select('id, name').then(({ data }: any) => setMilestones(data ?? []));
  }, [open, milestone, projectId]);

  const save = async () => {
    if (!form.name || !form.project_id) return toast.error('Name and project required');
    const payload = { ...form };
    const { error } = milestone?.id
      ? await (supabase as any).from('milestones').update(payload).eq('id', milestone.id)
      : await (supabase as any).from('milestones').insert(payload);
    if (error) return toast.error(error.message);
    toast.success('Milestone saved');
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{milestone?.id ? 'Edit Milestone' : 'New Milestone'}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Input placeholder="Milestone name" value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} />
          {!projectId && (
            <Select value={form.project_id ?? ''} onValueChange={v => setForm({ ...form, project_id: v })}>
              <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
              <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Textarea placeholder="Description" value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} />
          <Select value={form.milestone_type ?? ''} onValueChange={v => setForm({ ...form, milestone_type: v })}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><label className="text-xs text-muted-foreground">Planned Start</label><Input type="date" value={form.planned_start ?? ''} onChange={e => setForm({ ...form, planned_start: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground">Planned End</label><Input type="date" value={form.planned_end ?? ''} onChange={e => setForm({ ...form, planned_end: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground">Actual Start</label><Input type="date" value={form.actual_start ?? ''} onChange={e => setForm({ ...form, actual_start: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground">Actual End</label><Input type="date" value={form.actual_end ?? ''} onChange={e => setForm({ ...form, actual_end: e.target.value })} /></div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">% Complete: {form.pct_complete ?? 0}%</label>
            <Slider value={[form.pct_complete ?? 0]} max={100} step={1} onValueChange={([v]) => setForm({ ...form, pct_complete: v })} />
          </div>
          <Select value={form.responsible_id ?? ''} onValueChange={v => setForm({ ...form, responsible_id: v })}>
            <SelectTrigger><SelectValue placeholder="Responsible Person" /></SelectTrigger>
            <SelectContent>{staff.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>)}</SelectContent>
          </Select>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><label className="text-xs text-muted-foreground">Budget Allocated (₦)</label><Input type="number" value={form.budget_allocated ?? 0} onChange={e => setForm({ ...form, budget_allocated: Number(e.target.value) })} /></div>
            <div><label className="text-xs text-muted-foreground">Actual Cost (₦)</label><Input type="number" value={form.actual_cost ?? 0} onChange={e => setForm({ ...form, actual_cost: Number(e.target.value) })} /></div>
          </div>
          <Select value={form.status ?? 'not_started'} onValueChange={v => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g,' ')}</SelectItem>)}</SelectContent>
          </Select>
          <Textarea placeholder="Notes" value={form.notes ?? ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </div>
        <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
