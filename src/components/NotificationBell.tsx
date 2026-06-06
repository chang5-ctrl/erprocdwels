import { useEffect, useState } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  severity: string;
  is_read: boolean;
  created_at: string;
}

const sevDot: Record<string, string> = {
  info: 'bg-blue-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-destructive',
};

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, body, link, severity, is_read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(25);
    setItems((data ?? []) as NotificationRow[]);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase.channel('notif-bell')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const unread = items.filter(i => !i.is_read).length;

  const markAllRead = async () => {
    if (!user || !unread) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
  };

  const handleClick = async (n: NotificationRow) => {
    if (!n.is_read) await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-primary-foreground hover:bg-primary/80">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full bg-destructive px-1 text-[10px]">
              {unread > 9 ? '9+' : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b p-3">
          <span className="font-semibold text-sm">Notifications</span>
          <Button variant="ghost" size="sm" disabled={!unread} onClick={markAllRead} className="h-7 text-xs">
            <CheckCheck className="mr-1 h-3 w-3" /> Mark all read
          </Button>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-2 h-8 w-8 opacity-30" />
              You're all caught up.
            </div>
          ) : items.map(n => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={cn(
                'w-full border-b px-3 py-2.5 text-left transition-colors hover:bg-muted/50',
                !n.is_read && 'bg-primary/5',
              )}
            >
              <div className="flex items-start gap-2">
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', sevDot[n.severity] || sevDot.info)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{n.title}</p>
                    {!n.is_read && <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                  </div>
                  {n.body && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{formatDate(n.created_at)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
