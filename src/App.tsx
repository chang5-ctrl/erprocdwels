import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import RoleHome from "@/pages/RoleHome";
import ProjectList from "@/pages/projects/ProjectList";
import ProjectDetail from "@/pages/projects/ProjectDetail";
import JobCostSheetList from "@/pages/job-cost-sheets/JobCostSheetList";
import JobCostSheetForm from "@/pages/job-cost-sheets/JobCostSheetForm";
import AdminDashboard from "@/pages/admin/Dashboard";
import StaffList from "@/pages/admin/StaffList";
import RecentlyDeleted from "@/pages/admin/RecentlyDeleted";
import SupplierList from "@/pages/suppliers/SupplierList";
import DocumentList from "@/pages/documents/DocumentList";
import TeamChat from "@/pages/chat/TeamChat";
import BudgetList from "@/pages/budgets/BudgetList";
import BudgetDetail from "@/pages/budgets/BudgetDetail";
import ProjectManagerDashboard from "@/pages/dashboards/ProjectManagerDashboard";
import SiteManagerDashboard from "@/pages/dashboards/SiteManagerDashboard";
import AccountantDashboard from "@/pages/dashboards/AccountantDashboard";
import ProcurementDashboard from "@/pages/dashboards/ProcurementDashboard";
import DSRList from "@/pages/dsr/DSRList";
import DSRForm from "@/pages/dsr/DSRForm";
import VariationList from "@/pages/variations/VariationList";
import VariationForm from "@/pages/variations/VariationForm";
import MilestoneList from "@/pages/milestones/MilestoneList";
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
              <Route index element={<RoleHome />} />
              <Route path="projects" element={<ProjectList />} />
              <Route path="projects/:id" element={<ProjectDetail />} />
              <Route path="job-cost-sheets" element={<JobCostSheetList />} />
              <Route path="job-cost-sheets/:id" element={<JobCostSheetForm />} />
              <Route path="suppliers" element={<SupplierList />} />
              <Route path="documents" element={<DocumentList />} />
              <Route path="chat" element={<TeamChat />} />
              <Route path="budgets" element={<BudgetList />} />
              <Route path="budgets/:id" element={<BudgetDetail />} />
              <Route path="dashboard/pm" element={<ProjectManagerDashboard />} />
              <Route path="dashboard/site" element={<SiteManagerDashboard />} />
              <Route path="dashboard/accounts" element={<AccountantDashboard />} />
              <Route path="dashboard/procurement" element={<ProcurementDashboard />} />
              <Route path="dsr" element={<DSRList />} />
              <Route path="dsr/:id" element={<DSRForm />} />
              <Route path="variations" element={<VariationList />} />
              <Route path="variations/:id" element={<VariationForm />} />
              <Route path="milestones" element={<MilestoneList />} />
              <Route path="admin" element={<AdminDashboard />} />
              <Route path="admin/staff" element={<StaffList />} />
              <Route path="admin/recently-deleted" element={<RecentlyDeleted />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
