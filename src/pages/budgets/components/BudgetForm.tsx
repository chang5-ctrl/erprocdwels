import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface BudgetFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR'];

export default function BudgetForm({ open, onClose, onSuccess }: BudgetFormProps) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    project_id: '',
    analytic_account: '',
    date_from: '',
    date_to: '',
    responsible_id: '',
    currency: 'NGN',
  });

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: projs }, { data: stf }] = await Promise.all([
        supabase.from('projects').select('id, name').order('name'),
        supabase.from('user_profiles').select('user_id, full_name').order('full_name'),
      ]);
      setProjects(projs || []);
      setStaff(stf || []);
    })();
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: lastBudget } = await supabase
      .from('budgets')
      .select('budget_number')
      .order('created_at', { ascending: false })
      .limit(1);

    let nextNumber = 'BUDGET/00001';
    if (lastBudget && lastBudget.length > 0) {
      const m = lastBudget[0].budget_number?.match(/(\d+)$/);
      const lastNum = m ? parseInt(m[1], 10) : 0;
      nextNumber = `BUDGET/${String(lastNum + 1).padStart(5, '0')}`;
    }

    const { error } = await supabase.from('budgets').insert({
      budget_number: nextNumber,
      project_id: formData.project_id || null,
      analytic_account: formData.analytic_account || null,
      date_from: formData.date_from || null,
      date_to: formData.date_to || null,
      responsible_id: formData.responsible_id || null,
      currency: formData.currency,
      status: 'draft',
      created_by: user?.id,
    } as any);

    if (error) {
      toast.error(error.message || 'Failed to create budget');
    } else {
      toast.success(`Budget ${nextNumber} created successfully`);
      onClose();
      setFormData({ project_id: '', analytic_account: '', date_from: '', date_to: '', responsible_id: '', currency: 'NGN' });
      onSuccess?.();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Budget</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Project</Label>
            <Select value={formData.project_id} onValueChange={(v) => setFormData({ ...formData, project_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Analytic Account</Label>
            <Input
              value={formData.analytic_account}
              onChange={(e) => setFormData({ ...formData, analytic_account: e.target.value })}
              placeholder="e.g. Main Construction"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date From</Label>
              <Input type="date" value={formData.date_from} onChange={(e) => setFormData({ ...formData, date_from: e.target.value })} />
            </div>
            <div>
              <Label>Date To</Label>
              <Input type="date" value={formData.date_to} onChange={(e) => setFormData({ ...formData, date_to: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Responsible</Label>
              <Select value={formData.responsible_id} onValueChange={(v) => setFormData({ ...formData, responsible_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {staff.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Budget'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
