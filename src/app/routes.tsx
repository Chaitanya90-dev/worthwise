import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { AccountsPage } from '../pages/AccountsPage';
import { DashboardPage } from '../pages/DashboardPage';
import { InsurancePage } from '../pages/InsurancePage';
import { LoansPage } from '../pages/LoansPage';
import { MutualFundsPage } from '../pages/MutualFundsPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { SettingsPage } from '../pages/SettingsPage';
import { UpcomingPaymentsPage } from '../pages/UpcomingPaymentsPage';
import { paths } from './paths';

export const router = createBrowserRouter([
  {
    path: paths.dashboard,
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: paths.accounts.slice(1), element: <AccountsPage /> },
      { path: paths.loans.slice(1), element: <LoansPage /> },
      { path: paths.upcoming.slice(1), element: <UpcomingPaymentsPage /> },
      { path: paths.insurance.slice(1), element: <InsurancePage /> },
      { path: paths.mutualFunds.slice(1), element: <MutualFundsPage /> },
      { path: paths.settings.slice(1), element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

