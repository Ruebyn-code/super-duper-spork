import { useEffect } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { SessionProvider, useSession } from './context/SessionContext'
import { CartProvider } from './context/CartContext'
import { onRequiredReading } from './lib/api'
import AppShell from './components/AppShell'

import LoginPage from './pages/LoginPage'
import SetupPage from './pages/SetupPage'
import AcceptInvitePage from './pages/AcceptInvitePage'
import HomePage from './pages/HomePage'
import OrderingPage from './pages/OrderingPage'
import CartPage from './pages/CartPage'
import OrderHistoryPage from './pages/OrderHistoryPage'
import StockCountPage from './pages/StockCountPage'
import StockTransfersPage from './pages/StockTransfersPage'
import WastagePage from './pages/WastagePage'
import SalesPage from './pages/SalesPage'
import ReportingPage from './pages/ReportingPage'
import RosteringPage from './pages/RosteringPage'
import CommunicationsPage from './pages/CommunicationsPage'
import OpsManagementPage from './pages/OpsManagementPage'
import LearningCentrePage from './pages/LearningCentrePage'
import KnowledgeLibraryPage from './pages/KnowledgeLibraryPage'
import EmploymentDocumentsPage from './pages/EmploymentDocumentsPage'
import LabelsPage from './pages/LabelsPage'
import AdminPage from './pages/AdminPage'
import AccountsPage from './pages/AccountsPage'
import SettingsPage from './pages/SettingsPage'
import SettingsHubPage from './pages/SettingsHubPage'
import AwardSettingsPage from './pages/AwardSettingsPage'
import LocationSetupPage from './pages/LocationSetupPage'
import KioskPage from './pages/KioskPage'
import KioskDevicesPage from './pages/KioskDevicesPage'
import HelpPage from './pages/HelpPage'
import ConsolePage from './pages/ConsolePage'

function BootScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
      <div className="row" style={{ gap: 12, color: 'var(--muted)' }}>
        <span className="spinner" aria-hidden="true" />
        Loading Opstack…
      </div>
    </div>
  )
}

function Protected() {
  const { session, loading } = useSession()
  const location = useLocation()

  if (loading) return <BootScreen />
  if (!session) {
    const target = `${location.pathname}${location.search}`
    return <Navigate to={`/login?returnTo=${encodeURIComponent(target)}`} replace />
  }
  return <AppShell />
}

function RequiredReadingRedirect() {
  const navigate = useNavigate()
  useEffect(
    () =>
      onRequiredReading(() => {
        navigate('/communications?required=1')
      }),
    [navigate],
  )
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <CartProvider>
          <RequiredReadingRedirect />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/accept-invite" element={<AcceptInvitePage />} />

            <Route element={<Protected />}>
              <Route path="/" element={<OrderingPage />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/order-history" element={<OrderHistoryPage />} />
              <Route path="/stock-count" element={<StockCountPage />} />
              <Route path="/stock-transfers" element={<StockTransfersPage />} />
              <Route path="/wastage" element={<WastagePage />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/reporting" element={<ReportingPage />} />
              <Route path="/rostering" element={<RosteringPage />} />
              <Route path="/communications" element={<CommunicationsPage />} />
              <Route path="/ops-management" element={<OpsManagementPage />} />
              <Route path="/learning-centre" element={<LearningCentrePage />} />
              <Route path="/knowledge-library" element={<KnowledgeLibraryPage />} />
              <Route path="/employment-documents" element={<EmploymentDocumentsPage />} />
              <Route path="/labels" element={<LabelsPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/accounts" element={<AccountsPage />} />
              <Route path="/admin/settings" element={<SettingsPage />} />
              <Route path="/settings" element={<SettingsHubPage />} />
              <Route path="/settings/awards" element={<AwardSettingsPage />} />
              <Route path="/settings/devices" element={<KioskDevicesPage />} />
              <Route path="/location-setup-step" element={<LocationSetupPage />} />
              <Route path="/kiosk" element={<KioskPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/opstack" element={<ConsolePage />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Route>
          </Routes>
        </CartProvider>
      </SessionProvider>
    </BrowserRouter>
  )
}
