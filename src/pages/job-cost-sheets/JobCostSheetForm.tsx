import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Plus, Trash2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, stateLabels, stateColors } from '@/lib/format';
import type { Tables } from '@/integrations/supabase/types';

type Project = Tables<'projects'>;
type Product = Tables<'products'>;

interface CostLine {
  id?: string;
  job_type: string;
  description: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  total_cost: number;
  isNew?: boolean;
}

const stateFlow = ['draft', 'confirmed', 'budget_validated', 'approved', 'done'];

export default function JobCostSheetForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const isNew = !id || id === 'new';

  const [projects, setProjects] = useState<Project[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sheetId, setSheetId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [state, setState] = useState('draft');
  const [sheetName, setSheetName] = useState('');
  const [lines, setLines] = useState<CostLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchRefs = useCallback(async () => {
    const [pRes, prRes] = await Promise.all([
      supabase.from('projects').select('*').order('name'),
      supabase.from('products').select('*').order('name'),
    ]);
    setProjects(pRes.data ?? []);
    setProducts(prRes.data ?? []);
  }, []);

  useEffect(() => {
    fetchRefs();
    if (!isNew) {
      (async () => {
        const { data: sheet } = await supabase.from('job_cost_sheets').select('*').eq('id', id).single();
        if (!sheet) { toast.error('Cost sheet not found'); navigate('/job-cost-sheets'); return; }
        setSheetId(sheet.id);
        setSheetName(sheet.name);
        setProjectId(sheet.project_id || '');
        setState(sheet.state);

        const { data: linesData } = await supabase
          .from('job_cost_lines')
          .select('*')
          .eq('job_cost_sheet_id', sheet.id)
          .order('created_at');
        setLines(
          (linesData ?? []).map(l => ({
            id: l.id,
            job_type: l.job_type,
            description: l.description || '',
            product_id: l.product_id,
            quantity: l.quantity,
            unit_price: l.unit_price,
            total_cost: l.total_cost ?? l.quantity * l.unit_price,
          }))
        );
        setLoading(false);
      })();
    } else {
      setLoading(false);
    }
  }, [id]);

  const addLine = (jobType: string) => {
    setLines(prev => [...prev, {
      job_type: jobType,
      description: '',
      product_id: null,
      quantity: 1,
      unit_price: 0,
      total_cost: 0,
      isNew: true,
    }]);
  };

  const updateLine = (index: number, field: string, value: any) => {
    setLines(prev => {
      const updated = [...prev];
      (updated[index] as any)[field] = value;
      if (field === 'product_id' && value) {
        const prod = products.find(p => p.id === value);
        if (prod) updated[index].unit_price = prod.standard_price;
      }
      updated[index].total_cost = updated[index].quantity * updated[index].unit_price;
      return updated;
    });
  };

  const removeLine = async (index: number) => {
    const line = lines[index];
    if (line.id) {
      await supabase.from('job_cost_lines').delete().eq('id', line.id);
    }
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  const totalForType = (type: string) => lines.filter(l => l.job_type === type).reduce((s, l) => s + l.total_cost, 0);
  const grandTotal = lines.reduce((s, l) => s + l.total_cost, 0);

  const handleSave = async () => {
    if (!projectId) { toast.error('Please select a project'); return; }
    setSaving(true);
    try {
      let currentSheetId = sheetId;
      if (isNew) {
        const { data, error } = await supabase
          .from('job_cost_sheets')
          .insert({ project_id: projectId, state: 'draft', total_planned_cost: grandTotal, created_by: user?.id })
          .select('id, name')
          .single();
        if (error) throw error;
        currentSheetId = data.id;
        setSheetId(data.id);
        setSheetName(data.name);
      } else {
        const { error } = await supabase
          .from('job_cost_sheets')
          .update({ project_id: projectId, total_planned_cost: grandTotal })
          .eq('id', currentSheetId);
        if (error) throw error;
      }

      // Save lines
      for (const line of lines) {
        if (line.isNew || !line.id) {
          await supabase.from('job_cost_lines').insert({
            job_cost_sheet_id: currentSheetId,
            job_type: line.job_type,
            description: line.description || null,
            product_id: line.product_id || null,
            quantity: line.quantity,
            unit_price: line.unit_price,
          });
        } else {
          await supabase.from('job_cost_lines').update({
            description: line.description || null,
            product_id: line.product_id || null,
            quantity: line.quantity,
            unit_price: line.unit_price,
          }).eq('id', line.id);
        }
      }

      toast.success(isNew ? 'Cost sheet created' : 'Cost sheet updated');
      if (isNew) navigate(`/job-cost-sheets/${currentSheetId}`, { replace: true });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const advanceState = async () => {
    const currentIdx = stateFlow.indexOf(state);
    if (currentIdx >= stateFlow.length - 1) return;
    const nextState = stateFlow[currentIdx + 1];
    const { error } = await supabase.from('job_cost_sheets').update({ state: nextState }).eq('id', sheetId);
    if (error) { toast.error(error.message); return; }
    setState(nextState);
    toast.success(`State changed to ${stateLabels[nextState]}`);
  };

  const canAdvance = !isNew && state !== 'done' && (hasRole('admin') || hasRole('site_manager'));

  if (loading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  const renderLinesTable = (jobType: string, label: string) => {
    const typeLines = lines.map((l, i) => ({ ...l, _index: i })).filter(l => l.job_type === jobType);
    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{typeLines.length} {label} items</span>
          <Button size="sm" variant="outline" onClick={() => addLine(jobType)}>
            <Plus className="mr-1 h-3 w-3" /> Add {label}
          </Button>
        </div>
        {typeLines.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No {label.toLowerCase()} items added yet.</p>
        ) : (
          <div className="rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  {jobType === 'material' && <TableHead>Product</TableHead>}
                  <TableHead>Description</TableHead>
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead className="w-32">Unit Price (₦)</TableHead>
                  <TableHead className="w-32 text-right">Total (₦)</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {typeLines.map(line => (
                  <TableRow key={line._index}>
                    {jobType === 'material' && (
                      <TableCell>
                        <Select value={line.product_id || ''} onValueChange={v => updateLine(line._index, 'product_id', v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select product" /></SelectTrigger>
                          <SelectContent>
                            {products.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name} — {formatCurrency(p.standard_price)}/{p.unit_of_measure}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
                    <TableCell>
                      <Input className="h-8 text-xs" value={line.description} onChange={e => updateLine(line._index, 'description', e.target.value)} placeholder="Description" />
                    </TableCell>
                    <TableCell>
                      <Input className="h-8 text-xs" type="number" min={0} value={line.quantity} onChange={e => updateLine(line._index, 'quantity', parseFloat(e.target.value) || 0)} />
                    </TableCell>
                    <TableCell>
                      <Input className="h-8 text-xs" type="number" min={0} value={line.unit_price} onChange={e => updateLine(line._index, 'unit_price', parseFloat(e.target.value) || 0)} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatCurrency(line.total_cost)}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeLine(line._index)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={jobType === 'material' ? 4 : 3} className="text-right font-semibold text-sm">Subtotal</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{formatCurrency(totalForType(jobType))}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6">
      <Button variant="ghost" onClick={() => navigate('/job-cost-sheets')} className="mb-4">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Job Cost Sheets
      </Button>

      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-xl">
              {isNew ? 'New Job Cost Sheet' : sheetName}
            </CardTitle>
            {!isNew && (
              <Badge variant="secondary" className={`mt-1 ${stateColors[state]}`}>
                {stateLabels[state]}
              </Badge>
            )}
          </div>
          {canAdvance && (
            <Button onClick={advanceState} variant="outline">
              Advance to {stateLabels[stateFlow[stateFlow.indexOf(state) + 1]]}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Project *</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Grand Total</Label>
              <div className="flex h-10 items-center rounded-md border bg-muted/50 px-3 font-mono font-semibold text-foreground">
                {formatCurrency(grandTotal)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="pt-6">
          <Tabs defaultValue="material">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="material">Materials ({formatCurrency(totalForType('material'))})</TabsTrigger>
              <TabsTrigger value="labour">Labours ({formatCurrency(totalForType('labour'))})</TabsTrigger>
              <TabsTrigger value="overhead">Overhead ({formatCurrency(totalForType('overhead'))})</TabsTrigger>
            </TabsList>
            <TabsContent value="material" className="mt-4">
              {renderLinesTable('material', 'Material')}
            </TabsContent>
            <TabsContent value="labour" className="mt-4">
              {renderLinesTable('labour', 'Labour')}
            </TabsContent>
            <TabsContent value="overhead" className="mt-4">
              {renderLinesTable('overhead', 'Overhead')}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="mr-1 h-4 w-4" /> {saving ? 'Saving...' : 'Save Cost Sheet'}
        </Button>
      </div>
    </div>
  );
}
