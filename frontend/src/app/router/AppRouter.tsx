import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@app/layouts/AppLayout';
import { ROUTES } from '@app/config/routes';
import { RequireAuth, RequirePermission } from '@app/router/guards';

const LoginPage = lazy(() => import('@modules/auth/LoginPage'));
const SignupPage = lazy(() => import('@modules/auth/SignupPage'));
const DashboardPage = lazy(() => import('@modules/dashboard/DashboardPage'));
const LeadsPage = lazy(() => import('@modules/leads/LeadsPage'));
const InquiriesPage = lazy(() => import('@modules/inquiries/InquiriesPage'));
const ProposalsPage = lazy(() => import('@modules/proposals/ProposalsPage'));
const ProposalDetailPage = lazy(() => import('@modules/proposals/detail/ProposalDetailPage'));
const FollowupsPage = lazy(() => import('@modules/followups/FollowupsPage'));
const FulfillmentsPage = lazy(() => import('@modules/fulfillments/FulfillmentsPage'));
const OperationsPage = lazy(() => import('@modules/operations/OperationsPage'));
const HotelsPage = lazy(() => import('@modules/hotels/HotelsPage'));
const ServicesPage = lazy(() => import('@modules/services/ServicesPage'));
const AnalyticsPage = lazy(() => import('@modules/analytics/AnalyticsPage'));
const AiPage = lazy(() => import('@modules/ai/AiPage'));
const SettingsPage = lazy(() => import('@modules/settings/SettingsPage'));
const ComingSoonPage = lazy(() => import('@shared/components/layout/coming-soon'));
const NotFoundPage = lazy(() => import('@shared/components/NotFoundPage'));

export function AppRouter() {
  return (
    <Routes>
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route path={ROUTES.signup} element={<SignupPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to={ROUTES.dashboard} replace />} />
        <Route path={ROUTES.dashboard} element={<DashboardPage />} />
        <Route path={ROUTES.leads} element={<LeadsPage />} />
        <Route path={ROUTES.leadDetail()} element={<LeadsPage />} />
        <Route path={ROUTES.inquiries} element={<InquiriesPage />} />
        <Route path={ROUTES.proposals} element={<ProposalsPage />} />
        <Route path={ROUTES.proposalDetail()} element={<ProposalDetailPage />} />
        <Route path={ROUTES.followups} element={<FollowupsPage />} />
        <Route path={ROUTES.fulfillments} element={<FulfillmentsPage />} />
        <Route
          path={ROUTES.operations}
          element={
            <RequirePermission permission="operations.read">
              <OperationsPage />
            </RequirePermission>
          }
        />
        <Route path={ROUTES.hotels} element={<HotelsPage />} />
        <Route
          path={ROUTES.services}
          element={
            <RequirePermission permission="service.read">
              <ServicesPage />
            </RequirePermission>
          }
        />
        <Route
          path={ROUTES.analytics}
          element={
            <RequirePermission permission="report.read">
              <AnalyticsPage />
            </RequirePermission>
          }
        />
        <Route path={ROUTES.ai} element={<AiPage />} />
        <Route path={ROUTES.settings} element={<SettingsPage />} />
        <Route path={ROUTES.agencies} element={<ComingSoonPage title="Agencies" />} />
        <Route path={ROUTES.contacts} element={<ComingSoonPage title="Contacts" />} />
        <Route path={ROUTES.bookings} element={<ComingSoonPage title="Bookings" />} />
        <Route path={ROUTES.vouchers} element={<ComingSoonPage title="Vouchers" />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
