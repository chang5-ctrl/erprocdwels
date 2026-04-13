

# Construction ERP for Rocdwels Nigeria Ltd — Phase 1

## Overview
Build a construction ERP system with Supabase PostgreSQL backend, Odoo-style UI (replicating the Uppertec ERP look), and real database operations. Phase 1 covers **Projects + Job Cost Sheets** with authentication and role-based access.

## 1. Login Page
- Full-screen building/construction background image with a frosted-glass centered login card
- Rocdwels Nigeria Ltd logo at top of card
- Email and password fields with "Manage password" link
- Purple/gold "LOG IN" button matching the Uppertec style
- "Powered by Lovable" footer text
- Uses Supabase Auth (email/password)

## 2. Database Schema (Supabase migrations)

**Tables to create:**
- `user_roles` — role-based access (admin, site_manager, procurement_officer, accountant) with RLS security definer function
- `projects` — id, name, location, customer_name, status (active/completed/on_hold), created_at
- `job_cost_sheets` — id, name (auto-generated COST-SHEET/XXXXX), project_id (FK), state (draft→confirmed→budget_validated→approved→done), total_planned_cost, currency (default NGN), created_at
- `job_cost_lines` — id, job_cost_sheet_id (FK), job_type (material/labour/overhead), description, product_name, quantity, unit_price, total_cost
- `products` — id, name, standard_price, unit_of_measure

**Seed data:**
- Projects: "Wuse Zone 3", "Uppertec Homes and Luxury"
- Products: Cement (₦10,400), Sharp Sand (₦180,000), Plaster Sand (₦85,000)
- Test user accounts: admin@rocdwels.ng (admin role), manager@rocdwels.ng (site_manager role)

**RLS policies** on all tables — authenticated users can read, role-based write access.

## 3. App Layout (Post-Login)
- **Top navigation bar** — purple background with Rocdwels logo, module links (Projects, Job Cost Sheets), user menu with logout
- **Sidebar** — collapsible, showing sub-menu items per module
- **Main content area** — list views and form views

## 4. Projects Module
- **List view** — table showing all projects with name, location, customer, status
- **Form view** — create/edit project with all fields saving to real `projects` table
- Loading spinners while fetching, "No projects found" empty state

## 5. Job Cost Sheets Module
- **List view** — table with ID (COST-SHEET/XXXXX format), project name, state badge, total cost in ₦
- **Form view** with:
  - Project dropdown (queries real `projects` table)
  - State workflow buttons: Draft → Confirmed → Budget Validated → Approved → Done
  - **Three tabs: Materials | Labours | Overhead**
  - Each tab shows an editable table of line items (description, quantity, unit price, total)
  - Product dropdown in Materials tab queries real `products` table
  - All line items save to `job_cost_lines` with appropriate `job_type`
  - Auto-calculated totals per tab and grand total
  - Currency displayed as ₦ (NGN)

## 6. Authentication & Roles
- Supabase Auth with email/password sign-in
- User roles stored in `user_roles` table (not on profiles)
- `has_role()` security definer function for RLS
- Role-based UI: state transition buttons only visible to authorized roles
- Protected routes — redirect to login if not authenticated

## 7. UX Details
- Nigerian date format (DD/MM/YYYY) throughout
- Responsive layout for tablet use on construction sites
- Real-time data updates via Supabase subscriptions on key tables
- Toast notifications for successful saves and errors
- Loading states on all data fetches
- Purple/white Odoo-inspired color theme

