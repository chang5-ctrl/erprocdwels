import type { Database } from '@/integrations/supabase/types';

export type AppRole = Database['public']['Enums']['app_role'];

// Sidebar module keys
export type ModuleKey =
  | 'projects'
  | 'job-cost-sheets'
  | 'budgets'
  | 'suppliers'
  | 'materials'
  | 'documents'
  | 'chat'
  | 'dsr'
  | 'variations'
  | 'milestones'
  | 'dashboard'
  | 'staff'
  | 'recently-deleted';

// What each role is allowed to see in the sidebar
export const ROLE_MODULES: Record<AppRole, ModuleKey[]> = {
  admin: ['dashboard', 'projects', 'job-cost-sheets', 'budgets', 'suppliers', 'materials', 'documents', 'chat', 'dsr', 'variations', 'milestones', 'staff', 'recently-deleted'],
  project_manager: ['projects', 'job-cost-sheets', 'budgets', 'materials', 'documents', 'chat', 'dsr', 'variations', 'milestones'],
  site_manager: ['projects', 'materials', 'documents', 'chat', 'dsr', 'milestones'],
  accountant: ['projects', 'job-cost-sheets', 'budgets', 'materials', 'documents', 'chat', 'variations', 'milestones'],
  procurement_officer: ['suppliers', 'materials', 'documents', 'chat'],
};

// Capability flags per role
export interface Capabilities {
  // Projects
  createProject: boolean;
  editAnyProject: boolean;        // PM can only edit their own — handled by row check
  viewAllProjects: boolean;       // site_manager only sees assigned
  deleteProject: boolean;
  // Job cost sheets
  createCostSheet: boolean;
  approveCostSheet: boolean;
  // Budgets
  approveBudget: boolean;
  // Requisitions
  submitRequisition: boolean;
  confirmRequisitionSite: boolean;
  approveRequisition: boolean;
  // Suppliers
  manageSuppliers: boolean;
  // Staff
  manageStaff: boolean;
}

export const ROLE_CAPS: Record<AppRole, Capabilities> = {
  admin: {
    createProject: true, editAnyProject: true, viewAllProjects: true, deleteProject: true,
    createCostSheet: true, approveCostSheet: true,
    approveBudget: true,
    submitRequisition: true, confirmRequisitionSite: true, approveRequisition: true,
    manageSuppliers: true,
    manageStaff: true,
  },
  project_manager: {
    createProject: true, editAnyProject: false, viewAllProjects: true, deleteProject: false,
    createCostSheet: true, approveCostSheet: false,
    approveBudget: false,
    submitRequisition: true, confirmRequisitionSite: false, approveRequisition: false,
    manageSuppliers: false,
    manageStaff: false,
  },
  site_manager: {
    createProject: false, editAnyProject: false, viewAllProjects: false, deleteProject: false,
    createCostSheet: false, approveCostSheet: false,
    approveBudget: false,
    submitRequisition: true, confirmRequisitionSite: true, approveRequisition: false,
    manageSuppliers: false,
    manageStaff: false,
  },
  accountant: {
    createProject: false, editAnyProject: false, viewAllProjects: true, deleteProject: false,
    createCostSheet: false, approveCostSheet: true,
    approveBudget: true,
    submitRequisition: false, confirmRequisitionSite: false, approveRequisition: false,
    manageSuppliers: false,
    manageStaff: false,
  },
  procurement_officer: {
    createProject: false, editAnyProject: false, viewAllProjects: true, deleteProject: false,
    createCostSheet: false, approveCostSheet: false,
    approveBudget: false,
    submitRequisition: false, confirmRequisitionSite: false, approveRequisition: true,
    manageSuppliers: true,
    manageStaff: false,
  },
};

const EMPTY_CAPS: Capabilities = {
  createProject: false, editAnyProject: false, viewAllProjects: false, deleteProject: false,
  createCostSheet: false, approveCostSheet: false,
  approveBudget: false,
  submitRequisition: false, confirmRequisitionSite: false, approveRequisition: false,
  manageSuppliers: false, manageStaff: false,
};

export function capabilitiesFor(roles: AppRole[]): Capabilities {
  if (!roles.length) return EMPTY_CAPS;
  // Union of all role capabilities
  return roles.reduce<Capabilities>((acc, r) => {
    const c = ROLE_CAPS[r];
    if (!c) return acc;
    (Object.keys(acc) as (keyof Capabilities)[]).forEach(k => { if (c[k]) acc[k] = true; });
    return acc;
  }, { ...EMPTY_CAPS });
}

export function modulesFor(roles: AppRole[]): Set<ModuleKey> {
  const set = new Set<ModuleKey>();
  roles.forEach(r => ROLE_MODULES[r]?.forEach(m => set.add(m)));
  return set;
}
