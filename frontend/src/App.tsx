import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/common/Sidebar';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Application from './pages/Application';
import ApplicationDetail from './pages/ApplicationDetail';
import MyApplications from './pages/MyApplications';
import ApprovalInbox from './pages/ApprovalInbox';
import Accounting from './pages/Accounting';
import Admin from './pages/Admin';

function AppShell() {
  useRealtimeSync(); // single SSE connection for the entire authenticated session
  return (
    <div className="flex min-h-screen bg-warm-100">
      <Sidebar />
      <main className="flex-1 p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

function ProtectedRoute({ roles }: { roles?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        読み込み中...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return <AppShell />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/apply/:templateId" element={<Application />} />
        <Route path="/applications" element={<MyApplications />} />
        <Route path="/applications/:id" element={<ApplicationDetail />} />
      </Route>

      <Route element={<ProtectedRoute roles={['MANAGER', 'GM', 'PRESIDENT', 'ADMIN']} />}>
        <Route path="/inbox" element={<ApprovalInbox />} />
      </Route>

      <Route element={<ProtectedRoute roles={['ACCOUNTING', 'ADMIN']} />}>
        <Route path="/accounting" element={<Accounting />} />
      </Route>

      <Route element={<ProtectedRoute roles={['ADMIN']} />}>
        <Route path="/admin" element={<Admin />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
