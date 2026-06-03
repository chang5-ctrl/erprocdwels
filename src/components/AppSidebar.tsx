import { useEffect, useState } from 'react';
import { Building2, FileSpreadsheet, LogOut, LayoutDashboard, Users, Truck, FileText, MessageSquare, Wallet } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { modulesFor, type ModuleKey } from '@/lib/permissions';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';

type MenuItem = { title: string; url: string; icon: typeof Building2; module: ModuleKey; key?: 'chat' };

const baseMenu: MenuItem[] = [
  { title: 'Projects', url: '/projects', icon: Building2, module: 'projects' },
  { title: 'Job Cost Sheets', url: '/job-cost-sheets', icon: FileSpreadsheet, module: 'job-cost-sheets' },
  { title: 'Budgets', url: '/budgets', icon: Wallet, module: 'budgets' },
  { title: 'Suppliers', url: '/suppliers', icon: Truck, module: 'suppliers' },
  { title: 'Documents', url: '/documents', icon: FileText, module: 'documents' },
  { title: 'Team Chat', url: '/chat', icon: MessageSquare, module: 'chat', key: 'chat' },
];
const adminMenu: MenuItem[] = [
  { title: 'Dashboard', url: '/admin', icon: LayoutDashboard, module: 'dashboard' },
  { title: 'Staff', url: '/admin/staff', icon: Users, module: 'staff' },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { signOut, user, roles } = useAuth();
  const allowed = modulesFor(roles);
  const visibleBase = baseMenu.filter(m => allowed.has(m.module));
  const visibleAdmin = adminMenu.filter(m => allowed.has(m.module));
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const refresh = async () => {
      const { data: members } = await supabase
        .from('chat_channel_members')
        .select('channel_id, last_read_at')
        .eq('user_id', user.id);
      if (!members?.length) { setUnread(0); return; }
      let total = 0;
      for (const m of members) {
        const { count } = await supabase
          .from('chat_messages')
          .select('id', { count: 'exact', head: true })
          .eq('channel_id', m.channel_id)
          .gt('created_at', m.last_read_at)
          .neq('sender_id', user.id);
        total += count || 0;
      }
      setUnread(total);
    };
    refresh();
    const ch = supabase.channel('sidebar-chat-unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_channel_members' }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, location.pathname]);

  const renderItems = (items: MenuItem[]) => items.map((item) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild isActive={location.pathname.startsWith(item.url)}>
        <NavLink
          to={item.url}
          className="text-sidebar-foreground hover:bg-sidebar-accent"
          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
        >
          <item.icon className="mr-2 h-4 w-4" />
          {!collapsed && <span className="flex-1">{item.title}</span>}
          {item.key === 'chat' && unread > 0 && (
            <Badge className="ml-auto h-5 min-w-5 rounded-full bg-primary px-1.5 text-[10px]">{unread}</Badge>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  ));

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="bg-sidebar">
        {visibleBase.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider">
              Modules
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(visibleBase)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {visibleAdmin.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider">
              Administration
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(visibleAdmin)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="bg-sidebar border-t border-sidebar-border p-3">
        {!collapsed && user && (
          <p className="mb-2 truncate text-xs text-sidebar-foreground/60">{user.email}</p>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => signOut()}
              className="text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {!collapsed && <span>Log out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
