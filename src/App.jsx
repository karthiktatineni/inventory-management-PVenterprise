import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import ProtectedRoute, { RoleRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Billing from './pages/Billing';
import BillsHistory from './pages/BillsHistory';
import Settings from './pages/Settings';
import Workers from './pages/Workers';
import Reports from './pages/Reports';
import { auth } from './firebase';

const SessionManager = () => {
  React.useEffect(() => {
    const checkTimeout = () => {
      const now = new Date();
      // If it's exactly 1 AM (or between 1:00 and 1:05) and user is logged in
      if (now.getHours() === 1 && now.getMinutes() < 5 && auth.currentUser) {
        auth.signOut();
        // The AuthState listener in AuthContext will handle redirect/state update
      }
    };
    
    // Check every minute
    const interval = setInterval(checkTimeout, 60000);
    return () => clearInterval(interval);
  }, []);

  return null;
};

// Reports removed from placeholder as it is now imported from separate page

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter>
          <SessionManager />
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route element={<ProtectedRoute />}>
              {/* Owner Protected Routes */}
              <Route element={<RoleRoute roles={['owner']} />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/workers" element={<Workers />} />
              </Route>

              {/* Worker & Owner Protected Routes */}
              <Route element={<RoleRoute roles={['owner', 'worker']} />}>
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/bills-history" element={<BillsHistory />} />
              </Route>
            </Route>

            {/* Redirects */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
