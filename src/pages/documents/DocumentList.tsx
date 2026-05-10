import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FileText, Download, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/format';
import type { Tables } from '@/integrations/supabase/types';

type Doc = Tables<'documents'>;
type LinkFilter = 'all' | 'project' | 'job_cost_sheet' | 'supplier';
const PAGE_SIZE = 10;

function formatBytes(b: number | null) {
  if (!b) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0; let n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${u[i]}`;
}

export default function DocumentList() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const fileRef = useRef<HTMLInputElement>(null);

  const [docs, setDocs] = useState<Doc[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState<LinkFilter>('all');
  const [loading, setLoading] = useState(true);

  const [linkType, setLinkType] = useState<'project' | 'job_cost_sheet' | 'supplier'>('project');
  const [linkId, setLinkId] = useState<string>('');
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [sheets, setSheets] = useState<{ id: string; name: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleteDoc, setDeleteDoc] = useState<Doc | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [filter]);

  const fetchDocs = async () => {
    setLoading(true);
    let q = supabase.from('documents').select('*', { count: 'exact' });
    if (debounced) q = q.ilike('name', `%${debounced}%`);
    if (filter !== 'all') q = q.not(`${filter}_id`, 'is', null);
    const from = page * PAGE_SIZE;
    const { data, count } = await q.order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
    setDocs(data ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { fetchDocs(); }, [debounced, filter, page]);

  useEffect(() => {
    Promise.all([
      supabase.from('projects').select('id, name').order('name'),
      supabase.from('job_cost_sheets').select('id, name').order('name'),
      supabase.from('suppliers').select('id, name').order('name'),
    ]).then(([p, s, sup]) => {
      setProjects(p.data ?? []);
      setSheets(s.data ?? []);
      setSuppliers(sup.data ?? []);
    });
    const ch = supabase
      .channel('docs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => fetchDocs())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const linkOptions = linkType === 'project' ? projects : linkType === 'job_cost_sheet' ? sheets : suppliers;

  const onUpload = async (file: File) => {
    if (!user) return;
    if (!linkId) { toast({ title: 'Select a record to attach the file to', variant: 'destructive' }); return; }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${linkType}/${linkId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('documents').upload(path, file, {
      contentType: file.type,
    });
    if (upErr) {
      setUploading(false);
      toast({ title: 'Upload failed', description: upErr.message, variant: 'destructive' });
      return;
    }
    const row: any = {
      name: file.name,
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: user.id,
    };
    row[`${linkType}_id`] = linkId;
    const { error: dbErr } = await supabase.from('documents').insert([row]);
    setUploading(false);
    if (dbErr) {
      await supabase.storage.from('documents').remove([path]);
      toast({ title: 'Save failed', description: dbErr.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'File uploaded' });
    if (fileRef.current) fileRef.current.value = '';
  };

  const download = async (d: Doc) => {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(d.storage_path, 60);
    if (error || !data) {
      toast({ title: 'Download failed', description: error?.message, variant: 'destructive' });
      return;
    }
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = d.name;
    a.click();
  };

  const confirmDelete = async () => {
    if (!deleteDoc) return;
    const d = deleteDoc;
    setDeleteDoc(null);
    const { error: sErr } = await supabase.storage.from('documents').remove([d.storage_path]);
    if (sErr) { toast({ title: 'File delete failed', description: sErr.message, variant: 'destructive' }); return; }
    const { error: dbErr } = await supabase.from('documents').delete().eq('id', d.id);
    if (dbErr) { toast({ title: 'Record delete failed', description: dbErr.message, variant: 'destructive' }); return; }
    toast({ title: 'Document deleted' });
  };

  const linkLabel = (d: Doc) => {
    if (d.project_id) return `Project: ${projects.find(p => p.id === d.project_id)?.name ?? '—'}`;
    if (d.job_cost_sheet_id) return `Cost Sheet: ${sheets.find(s => s.id === d.job_cost_sheet_id)?.name ?? '—'}`;
    if (d.supplier_id) return `Supplier: ${suppliers.find(s => s.id === d.supplier_id)?.name ?? '—'}`;
    return '—';
  };

  const canDelete = (d: Doc) => isAdmin || d.uploaded_by === user?.id;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2">
        <FileText className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Documents</h1>
      </div>

      <div className="mb-6 rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Upload Document</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="grid gap-1.5">
            <Label>Attach to</Label>
            <Select value={linkType} onValueChange={(v: any) => { setLinkType(v); setLinkId(''); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="job_cost_sheet">Cost Sheet</SelectItem>
                <SelectItem value="supplier">Supplier</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 md:col-span-2">
            <Label>Record</Label>
            <Select value={linkId} onValueChange={setLinkId}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {linkOptions.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>File</Label>
            <Input
              ref={fileRef}
              type="file"
              disabled={uploading || !linkId}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }}
            />
          </div>
        </div>
        {uploading && <p className="mt-2 text-xs text-muted-foreground">Uploading…</p>}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search file name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All documents</SelectItem>
            <SelectItem value="project">Projects only</SelectItem>
            <SelectItem value="job_cost_sheet">Cost Sheets only</SelectItem>
            <SelectItem value="supplier">Suppliers only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <FileText className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">
            {debounced ? `No documents match "${debounced}".` : 'No documents yet. Upload your first file above.'}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Linked To</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="text-muted-foreground">{linkLabel(d)}</TableCell>
                    <TableCell>{formatBytes(d.size_bytes)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(d.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => download(d)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      {canDelete(d) && (
                        <Button variant="ghost" size="icon" onClick={() => setDeleteDoc(d)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} document{total === 1 ? '' : 's'} • Page {page + 1} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <AlertDialog open={!!deleteDoc} onOpenChange={(o) => !o && setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes both the file from storage and the database record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
