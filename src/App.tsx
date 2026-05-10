import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import ProjectList from "@/pages/projects/ProjectList";
import ProjectForm from "@/pages/projects/ProjectForm";
import JobCostSheetList from "@/pages/job-cost-sheets/JobCostSheetList";
import JobCostSheetForm from "@/pages/job-cost-sheets/JobCostSheetForm";
import AdminDashboard from "@/pages/admin/Dashboard";
import StaffList from "@/pages/admin/StaffList";
import SupplierList from "@/pages/suppliers/SupplierList";
import DocumentList from "@/pages/documents/DocumentList";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Navigate to="/projects" replace />} />
              <Route path="projects" element={<ProjectList />} />
              <Route path="projects/:id" element={<ProjectForm />} />
              <Route path="job-cost-sheets" element={<JobCostSheetList />} />
              <Route path="job-cost-sheets/:id" element={<JobCostSheetForm />} />
              <Route path="admin" element={<AdminDashboard />} />
              <Route path="admin/staff" element={<StaffList />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
