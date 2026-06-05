import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, RotateCcw, ShieldAlert, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/format';
import { SOFT_DELETE_TABLES, TABLE_LABELS, NAME_COLUMN, softRestore, hardDelete, type SoftDeleteTable } from '@/lib/soft-delete';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';

interface DeletedRow {
  id: string;
  table: SoftDeleteTable;
  label: string;
  deleted_at: string;
  deleted_by: string | null;
}

const RETENTION_DAYS = 30;

export default function RecentlyDeleted() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [rows, setRows] = useState<DeletedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [moduleFilter, setModuleFilter] = useState<'all' | SoftDeleteTable>('all');
  const [userFilter, setUserFilter] = useState<'all' | string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [confirmRestore, setConfirmRestore] = useState<DeletedRow | null>(null);
  const [confirmPurge, setConfirmPurge] = useState<DeletedRow | null>(null);

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card><CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
          <ShieldAlert className="h-5 w-5" /> Only administrators can access Recently Deleted.
        </CardContent></Card>
      </div>
    );
  }

  const loadAll = async () => {
    setLoading(true);
    const results = await Promise.all(
      SOFT_DELETE_TABLES.map(async (t) => {
        const name = NAME_COLUMN[t];
        const { data } = await (supabase as any)
          .from(t)
          .select(`id, ${name}, deleted_at, deleted_by`)
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false });
        return (data ?? []).map((r: any) => ({
          id: r.id,
          table: t,
          label: r[name] ? String(r[name]).slice(0, 80) : '(no name)',
          deleted_at: r.deleted_at,
          deleted_by: r.deleted_by,
        })) as DeletedRow[];
      }),
    );
    const merged = results.flat().sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));
    setRows(merged);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    supabase.from('user_profiles').select('user_id, full_name').then(({ data }) => {
      const m: Record<string, string> = {};
      (data ?? []).forEach(p => { if (p.user_id) m[p.user_id] = p.full_name ?? '—'; });
      setProfiles(m);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r =>
      (moduleFilter === 'all' || r.table === moduleFilter) &&
      (userFilter === 'all' || r.deleted_by === userFilter) &&
      (!fromDate || r.deleted_at >= fromDate) &&
      (!toDate || r.deleted_at <= toDate + 'T23:59:59') &&
      (!q || r.label.toLowerCase().includes(q))
    );
  }, [rows, moduleFilter, userFilter, fromDate, toDate, search]);

  const summary = useMemo(() => {
    const byModule: Record<string, number> = {};
    rows.forEach(r => { byModule[r.table] = (byModule[r.table] || 0) + 1; });
    return { total: rows.length, byModule };
  }, [rows]);

  const daysRemaining = (deletedAt: string) => {
    const elapsed = (Date.now() - new Date(deletedAt).getTime()) / 86400000;
    return Math.max(0, Math.ceil(RETENTION_DAYS - elapsed));
  };

  const barColor = (days: number) => {
    if (days > 14) return 'bg-emerald-500';
    if (days > 5) return 'bg-amber-500';
    return 'bg-destructive';
  };

  const doRestore = async (r: DeletedRow) => {
    setConfirmRestore(null);
    const { error } = await softRestore({ table: r.table, id: r.id, label: r.label });
    if (error) { toast({ title: 'Restore failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `${TABLE_LABELS[r.table]} restored` });
    loadAll();
  };

  const doPurge = async (r: DeletedRow) => {
    setConfirmPurge(null);
    const { error } = await hardDelete({ table: r.table, id: r.id, label: r.label });
    if (error) { toast({ title: 'Permanent delete failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Permanently deleted' });
    loadAll();
  };

  const uniqueUsers = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.deleted_by) set.add(r.deleted_by); });
    return Array.from(set);
  }, [rows]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Trash2 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Recently Deleted</h1>
        <Badge variant="secondary" className="ml-2">{summary.total} item{summary.total === 1 ? '' : 's'}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Items are kept for {RETENTION_DAYS} days. After that they are moved to the Archive (coming soon).
      </p>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search item name…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={moduleFilter} onValueChange={(v: any) => setModuleFilter(v)}>
            <SelectTrigger><SelectValue placeholder="Module" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modules</SelectItem>
              {SOFT_DELETE_TABLES.map(t => (
                <SelectItem key={t} value={t}>{TABLE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger><SelectValue placeholder="Deleted by" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Anyone</SelectItem>
              {uniqueUsers.map(uid => (
                <SelectItem key={uid} value={uid}>{profiles[uid] ?? uid.slice(0, 8)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Trash2 className="mx-auto mb-3 h-12 w-12 opacity-30" />
              {rows.length === 0 ? 'Nothing has been deleted yet.' : 'No items match the current filters.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Deleted by</TableHead>
                  <TableHead>Deleted on</TableHead>
                  <TableHead className="w-48">Days remaining</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => {
                  const days = daysRemaining(r.deleted_at);
                  const pct = (days / RETENTION_DAYS) * 100;
                  return (
                    <TableRow key={`${r.table}-${r.id}`}>
                      <TableCell><Badge variant="outline">{TABLE_LABELS[r.table]}</Badge></TableCell>
                      <TableCell className="max-w-xs truncate font-medium">{r.label}</TableCell>
                      <TableCell className="text-muted-foreground">{r.deleted_by ? (profiles[r.deleted_by] ?? '—') : '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(r.deleted_at)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress value={pct} className="h-2 [&>div]:transition-all" indicatorClassName={barColor(days)} />
                          <span className="text-xs text-muted-foreground">{days} day{days === 1 ? '' : 's'} left</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setConfirmRestore(r)}>
                          <RotateCcw className="mr-1 h-4 w-4" /> Restore
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmPurge(r)}>
                          <Trash2 className="mr-1 h-4 w-4" /> Delete forever
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={!!confirmPurge}
        onOpenChange={(o) => !o && setConfirmPurge(null)}
        itemLabel={confirmPurge?.label}
        variant="permanent"
        onConfirm={() => confirmPurge && doPurge(confirmPurge)}
      />
      <ConfirmDeleteDialog
        open={!!confirmRestore}
        onOpenChange={(o) => !o && setConfirmRestore(null)}
        itemLabel={confirmRestore?.label}
        variant="soft"
        onConfirm={() => confirmRestore && doRestore(confirmRestore)}
      />
    </div>
  );
}
