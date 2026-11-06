import { lazy, Suspense, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { EventScopeGuard, RequireAuth, RequireMfa, RequireRole } from './guards';
import type { AppRole } from '../data/types';

/* ── Espaces ───────────────────────────────────────────────────────────────
 *  1. espace salarie  : `/`, `/report`, `/my-reports`, `/instructions`
 *  2. espace metier   : `/hse/*`
 *  3. espace medical  : `/medical/*`
 *  4. espace admin    : `/admin/*`
 * Les modules lourds (assistant, rapports, graphiques) sont charges a la
 * demande (section 11.5).
 */

/* Espace salarie */
const LoginPage = lazy(() => import('../features/auth/LoginPage'));
const HomePage = lazy(() => import('../features/home/HomePage'));
const ReportForm = lazy(() => import('../features/reporting/ReportForm'));
const ReportSuccess = lazy(() => import('../features/reporting/ReportSuccess'));
const MyReports = lazy(() => import('../features/reporting/MyReports'));
const MyReportDetail = lazy(() => import('../features/reporting/MyReportDetail'));
const InstructionsList = lazy(() => import('../features/instructions/InstructionsList'));
const InstructionDetail = lazy(() => import('../features/instructions/InstructionDetail'));

/* Espace metier */
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage'));
const EventsList = lazy(() => import('../features/events/EventsList'));
const EventDetail = lazy(() => import('../features/events/EventDetail'));
const EventTriage = lazy(() => import('../features/events/EventTriage'));
const EventActions = lazy(() => import('../features/events/EventActions'));
const ActionsList = lazy(() => import('../features/actions/ActionsList'));
const ActionDetail = lazy(() => import('../features/actions/ActionDetail'));
const ActionVerify = lazy(() => import('../features/actions/ActionVerify'));
const EscalationsPage = lazy(() => import('../features/dashboard/EscalationsPage'));
const RecurrencesPage = lazy(() => import('../features/dashboard/RecurrencesPage'));
const ReportsPage = lazy(() => import('../features/dashboard/ReportsPage'));

/* Module assistant : charge dynamiquement (section 11.5) */
const AssistantPage = lazy(() => import('../features/assistant/AssistantPage'));

/* Espace medical */
const MedicalPage = lazy(() => import('../features/medical/MedicalPage'));
const MedicalRecordDetail = lazy(() => import('../features/medical/MedicalRecordDetail'));

/* Espace transversal */
const NotificationsPage = lazy(() => import('../features/notifications/NotificationsPage'));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage'));
const SecurityPage = lazy(() => import('../features/settings/SecurityPage'));

/* Espace admin */
const AdminDashboard = lazy(() => import('../features/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('../features/admin/AdminUsers'));
const AdminSites = lazy(() => import('../features/admin/AdminSites'));
const AdminCategories = lazy(() => import('../features/admin/AdminCategories'));
const AdminDocuments = lazy(() => import('../features/admin/AdminDocuments'));
const AdminAudit = lazy(() => import('../features/admin/AdminAudit'));
const AdminOutbox = lazy(() => import('../features/admin/AdminOutbox'));
const AdminSettings = lazy(() => import('../features/admin/AdminSettings'));

const ALL_ROLES: AppRole[] = [
  'worker',
  'supervisor',
  'hse_officer',
  'maintenance_lead',
  'action_owner',
  'occupational_physician',
  'site_director',
  'admin',
];

const WORKER_ROLES: AppRole[] = ['worker', 'supervisor'];
const REPORT_ROLES: AppRole[] = ['worker', 'supervisor', 'action_owner', 'maintenance_lead'];
const HSE_ROLES: AppRole[] = ['hse_officer', 'supervisor', 'site_director'];
const HSE_CORE: AppRole[] = ['hse_officer', 'supervisor'];
const HSE_MANAGER: AppRole[] = ['hse_officer', 'site_director'];
const ACTION_ROLES: AppRole[] = ['action_owner', 'maintenance_lead', 'hse_officer'];
const MEDICAL_ROLES: AppRole[] = ['occupational_physician'];
const ADMIN_ROLES: AppRole[] = ['admin'];

/** Enveloppe : authentification + MFA + role. */
function guarded(roles: AppRole[], element: ReactNode) {
  return (
    <RequireAuth>
      <RequireMfa>
        <RequireRole roles={roles}>{element}</RequireRole>
      </RequireMfa>
    </RequireAuth>
  );
}

/** Chargement des modules a la demande. */
function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p className="muted">Loading…</p>}>{children}</Suspense>;
}

/** Element d'ecran : enveloppe le lazy loading. */
function screen(element: ReactNode) {
  return <Lazy>{element}</Lazy>;
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={screen(<LoginPage />)}
      />

      {/* ── Espace salarie ───────────────────────────────────────────── */}
      <Route element={<AppLayout />}>
        <Route path="/" element={guarded(ALL_ROLES, screen(<HomePage />))} />
        <Route path="/report" element={guarded(WORKER_ROLES, screen(<ReportForm />))} />
        <Route path="/report/:kind" element={guarded(WORKER_ROLES, screen(<ReportForm />))} />
        <Route path="/report/success" element={guarded(ALL_ROLES, screen(<ReportSuccess />))} />
        <Route path="/my-reports" element={guarded(REPORT_ROLES, screen(<MyReports />))} />
        <Route path="/my-reports/:id" element={guarded(REPORT_ROLES, screen(<MyReportDetail />))} />
        <Route path="/instructions" element={guarded(ALL_ROLES, screen(<InstructionsList />))} />
        <Route path="/instructions/:id" element={guarded(ALL_ROLES, screen(<InstructionDetail />))} />

        {/* ── Espace metier ─────────────────────────────────────────── */}
        <Route path="/hse" element={guarded(HSE_ROLES, screen(<DashboardPage />))} />
        <Route path="/hse/events" element={guarded(HSE_ROLES, screen(<EventsList />))} />
        <Route
          path="/hse/events/:id"
          element={guarded(HSE_CORE, screen(
            <EventScopeGuard>
              <EventDetail />
            </EventScopeGuard>,
          ))}
        />
        <Route path="/hse/events/:id/triage" element={guarded(['hse_officer'], screen(<EventTriage />))} />
        <Route path="/hse/events/:id/actions" element={guarded(['hse_officer'], screen(<EventActions />))} />
        <Route path="/hse/actions" element={guarded(HSE_ROLES.concat(ACTION_ROLES), screen(<ActionsList />))} />
        <Route path="/hse/actions/:id" element={guarded(ACTION_ROLES, screen(<ActionDetail />))} />
        <Route path="/hse/actions/:id/verify" element={guarded(HSE_MANAGER, screen(<ActionVerify />))} />
        <Route path="/hse/escalations" element={guarded(HSE_MANAGER, screen(<EscalationsPage />))} />
        <Route path="/hse/assistant" element={guarded(['hse_officer'], screen(<AssistantPage />))} />
        <Route path="/hse/recurrences" element={guarded(HSE_MANAGER, screen(<RecurrencesPage />))} />
        <Route path="/hse/reports" element={guarded(HSE_MANAGER, screen(<ReportsPage />))} />

        {/* ── Espace medical ────────────────────────────────────────── */}
        <Route path="/medical" element={guarded(MEDICAL_ROLES, screen(<MedicalPage />))} />
        <Route path="/medical/:eventId" element={guarded(MEDICAL_ROLES, screen(<MedicalRecordDetail />))} />

        {/* ── Transversal ───────────────────────────────────────────── */}
        <Route path="/notifications" element={guarded(ALL_ROLES, screen(<NotificationsPage />))} />
        <Route path="/settings" element={guarded(ALL_ROLES, screen(<SettingsPage />))} />
        <Route path="/settings/security" element={guarded(ALL_ROLES, screen(<SecurityPage />))} />

        {/* ── Espace admin ──────────────────────────────────────────── */}
        <Route path="/admin" element={guarded(ADMIN_ROLES, screen(<AdminDashboard />))} />
        <Route path="/admin/users" element={guarded(ADMIN_ROLES, screen(<AdminUsers />))} />
        <Route path="/admin/sites" element={guarded(ADMIN_ROLES, screen(<AdminSites />))} />
        <Route path="/admin/categories" element={guarded(ADMIN_ROLES, screen(<AdminCategories />))} />
        <Route path="/admin/documents" element={guarded(ADMIN_ROLES, screen(<AdminDocuments />))} />
        <Route path="/admin/audit" element={guarded(ADMIN_ROLES, screen(<AdminAudit />))} />
        <Route path="/admin/outbox" element={guarded(ADMIN_ROLES, screen(<AdminOutbox />))} />
        <Route path="/admin/settings" element={guarded(ADMIN_ROLES, screen(<AdminSettings />))} />
      </Route>

      {/* 404 */}
      <Route
        path="*"
        element={
          <RequireAuth>
            <RequireMfa>
              <div className="panel">
                <h1 style={{ fontSize: 'var(--fs-22)' }}>Page not found</h1>
                <p>The page you requested does not exist.</p>
                <a className="btn primary" href="/">
                  Back to the home page
                </a>
              </div>
            </RequireMfa>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
