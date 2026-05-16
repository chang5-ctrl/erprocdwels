import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activity';
import type { Tables } from '@/integrations/supabase/types';

type Project = Tables<'projects'>;

const CATEGORIES = ['materials', 'labour', 'equipment', 'overhead'];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}

export default function JobCostSheetDialog({ open, onOpenChange, onSaved }: Props) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [category, setCategory] = useState('materials');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [sheetDate, setSheetDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from('projects').select('*').order('name').then(({ data }) => setProjects(data ?? []));
    setProjectId(''); setCategory('materials'); setDescription('');
    setAmount(''); setSheetDate(new Date().toISOString().slice(0, 10));
    setNotes(''); setReceipt(null);
  }, [open]);

  const handleSave = async () => {
    if (!projectId) { toast.error('Select a project'); return; }
    if (!amount || isNaN(parseFloat(amount))) { toast.error('Enter a valid amount'); return; }
    setSaving(true);
    try {
      let receipt_path: string | null = null;
      if (receipt) {
        const path = `cost-sheet-receipts/${user?.id}/${Date.now()}-${receipt.name}`;
        const { error: upErr } = await supabase.storage.from('documents').upload(path, receipt);
        if (upErr) throw upErr;
        receipt_path = path;
      }
      const { data, error } = await supabase.from('job_cost_sheets').insert({
        project_id: projectId,
        category,
        description: description || null,
        amount: parseFloat(amount),
        sheet_date: sheetDate,
        receipt_path,
        notes: notes || null,
        status: 'pending',
        total_planned_cost: parseFloat(amount),
        created_by: user?.id,
      }).select('id, name').single();
      if (error) throw error;
      await logActivity('job_cost_sheet', 'created', data.id, { name: data.name, category, amount });
      toast.success('Cost sheet created');
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Cost Sheet</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Project *</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" value={sheetDate} onChange={e => setSheetDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description" />
          </div>
          <div className="space-y-1.5">
            <Label>Amount (₦) *</Label>
            <Input type="number" min={0} step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Upload Receipt</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={e => setReceipt(e.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
