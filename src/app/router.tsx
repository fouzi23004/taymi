import { createBrowserRouter } from 'react-router'
import { AdminOnly, RequireAuth, StaffOnly } from '@/auth/guards'
import { AppShell } from '@/components/layout/AppShell'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { LoginPage } from '@/features/auth/LoginPage'
import { NotFound } from '@/features/misc/NotFound'
import { TimesheetPage } from '@/features/timesheet/TimesheetPage'

// The timesheet is what most people open every day: keep it in the main
// bundle. Manager and setup pages (and the charting library) load on demand.
export const router = createBrowserRouter([
  { path: '/login', Component: LoginPage },
  {
    Component: RequireAuth,
    HydrateFallback: FullPageSpinner,
    children: [
      {
        Component: AppShell,
        children: [
          { index: true, Component: TimesheetPage },
          { path: 'reports', lazy: () => import('@/features/reports/ReportsPage').then((m) => ({ Component: m.ReportsPage })) },
          { path: 'account', lazy: () => import('@/features/account/AccountPage').then((m) => ({ Component: m.AccountPage })) },
          {
            Component: StaffOnly,
            children: [
              { path: 'dashboard', lazy: () => import('@/features/dashboard/DashboardPage').then((m) => ({ Component: m.DashboardPage })) },
              { path: 'clients', lazy: () => import('@/features/admin/ClientsPage').then((m) => ({ Component: m.ClientsPage })) },
              { path: 'tasks', lazy: () => import('@/features/admin/TasksPage').then((m) => ({ Component: m.TasksPage })) },
            ],
          },
          {
            Component: AdminOnly,
            children: [{ path: 'team', lazy: () => import('@/features/admin/TeamPage').then((m) => ({ Component: m.TeamPage })) }],
          },
          { path: '*', Component: NotFound },
        ],
      },
    ],
  },
], { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' })
