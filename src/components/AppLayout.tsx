import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import logo from '@/assets/logo.png';

export default function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top nav bar */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-primary px-4">
            <SidebarTrigger className="text-primary-foreground hover:bg-primary/80" />
            <div className="flex items-center gap-2">
              <img src={logo} alt="Logo" className="h-8 w-8" width={512} height={512} />
              <span className="font-bold text-primary-foreground text-lg hidden sm:inline">
                Rocdwels ERP
              </span>
            </div>
          </header>

          <main className="flex-1 overflow-auto bg-muted/30">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
