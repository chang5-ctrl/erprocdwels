import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function ProjectForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [form, setForm] = useState({ name: '', location: '', customer_name: '', status: 'active' });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew) {
      supabase.from('projects').select('*').eq('id', id).single().then(({ data, error }) => {
        if (error || !data) { toast.error('Project not found'); navigate('/projects'); return; }
        setForm({ name: data.name, location: data.location || '', customer_name: data.customer_name || '', status: data.status });
        setLoading(false);
      });
    }
  }, [id]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Project name is required'); return; }
    setSaving(true);
    try {
      if (isNew) {
        const { error } = await supabase.from('projects').insert(form);
        if (error) throw error;
        toast.success('Project created');
      } else {
        const { error } = await supabase.from('projects').update(form).eq('id', id);
        if (error) throw error;
        toast.success('Project updated');
      }
      navigate('/projects');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <Button variant="ghost" onClick={() => navigate('/projects')} className="mb-4">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Projects
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{isNew ? 'New Project' : 'Edit Project'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Project Name *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Enter project name" />
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Wuse, Abuja" />
          </div>
          <div className="space-y-2">
            <Label>Customer Name</Label>
            <Input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Enter customer name" />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            <Save className="mr-1 h-4 w-4" /> {saving ? 'Saving...' : 'Save Project'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
