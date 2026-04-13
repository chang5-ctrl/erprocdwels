import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Building2 } from 'lucide-react';
import { formatDate, statusLabels, statusColors } from '@/lib/format';
import type { Tables } from '@/integrations/supabase/types';

type Project = Tables<'projects'>;

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    setLoading(true);
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    setProjects(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
    const channel = supabase
      .channel('projects-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => fetchProjects())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
        </div>
        <Link to="/projects/new">
          <Button><Plus className="mr-1 h-4 w-4" /> New Project</Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <Building2 className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">No projects found. Create your first project.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map(p => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <Link to={`/projects/${p.id}`} className="font-medium text-primary hover:underline">
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell>{p.location || '—'}</TableCell>
                  <TableCell>{p.customer_name || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColors[p.status]}>
                      {statusLabels[p.status] || p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
