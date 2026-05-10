import { Building2, FileSpreadsheet, LogOut, LayoutDashboard, Users, Truck, FileText } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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

const baseMenu = [
  { title: 'Projects', url: '/projects', icon: Building2 },
  { title: 'Job Cost Sheets', url: '/job-cost-sheets', icon: FileSpreadsheet },
  { title: 'Suppliers', url: '/suppliers', icon: Truck },
  { title: 'Documents', url: '/documents', icon: FileText },
];
const adminMenu = [
  { title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
  { title: 'Staff', url: '/admin/staff', icon: Users },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { signOut, user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const renderItems = (items: typeof baseMenu) => items.map((item) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild isActive={location.pathname.startsWith(item.url)}>
        <NavLink
          to={item.url}
          className="text-sidebar-foreground hover:bg-sidebar-accent"
          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
        >
          <item.icon className="mr-2 h-4 w-4" />
          {!collapsed && <span>{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  ));

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider">
            Modules
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(baseMenu)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider">
              Administration
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(adminMenu)}</SidebarMenu>
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
