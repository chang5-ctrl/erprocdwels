import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface BudgetFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function BudgetForm({ open, onClose, onSuccess }: BudgetFormProps) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    project_id: '',
    analytic_account: '',
    date_from: '',
    date_to: '',
    responsible_id: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: projs }, { data: stf }] = await Promise.all([
        supabase.from('projects').select('id, name'),
        supabase.from('user_profiles').select('id, full_name'),
      ]);
      setProjects(projs || []);
      setStaff(stf || []);
    };
    if (open) fetchData();
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Generate budget number
    const { data: lastBudget } = await supabase
      .from('budgets')
      .select('budget_number')
      .order('created_at', { ascending: false })
      .limit(1);

    let nextNumber = 'BUDGET/00001';
    if (lastBudget && lastBudget.length > 0) {
      const lastNum = parseInt(lastBudget[0].budget_number.split('/')[1]);
      nextNumber = `BUDGET/${String(lastNum + 1).padStart(5, '0')}`;
    }

    const { error } = await supabase
      .from('budgets')
      .insert({
        budget_number: nextNumber,
        project_id: formData.project_id || null,
        analytic_account: formData.name,  // Temporarily storing budget name here
        date_from: formData.date_from ? format(new Date(formData.date_from), 'yyyy-MM-dd') : null,
        date_to: formData.date_to ? format(new Date(formData.date_to), 'yyyy-MM-dd') : null,
        responsible_id: formData.responsible_id || null,
        status: 'draft',
        created_by: user?.id,
      });

    if (error) {
      toast.error('Failed to create budget');
    } else {
      toast.success('Budget created successfully');
      onClose();
      setFormData({ name: '', project_id: '', analytic_account: '', date_from: '', date_to: '', responsible_id: '' });
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
            <Label>Budget Name</Label>
            <Input 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="Enter budget name"
            />
          </div>

          <div>
            <Label>Project</Label>
            <Select value={formData.project_id} onValueChange={(v) => setFormData({...formData, project_id: v})}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Analytic Account</Label>
            <Input 
              value={formData.analytic_account}
              onChange={(e) => setFormData({...formData, analytic_account: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date From</Label>
              <Input type="date" value={formData.date_from} onChange={(e) => setFormData({...formData, date_from: e.target.value})} />
            </div>
            <div>
              <Label>Date To</Label>
              <Input type="date" value={formData.date_to} onChange={(e) => setFormData({...formData, date_to: e.target.value})} />
            </div>
          </div>

          <div>
            <Label>Responsible</Label>
            <Select value={formData.responsible_id} onValueChange={(v) => setFormData({...formData, responsible_id: v})}>
              <SelectTrigger>
                <SelectValue placeholder="Select responsible" />
              </SelectTrigger>
              <SelectContent>
                {staff.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Budget'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
