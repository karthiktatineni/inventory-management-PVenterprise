import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Billing from './pages/Billing';
import BillsHistory from './pages/BillsHistory';
import Settings from './pages/Settings';
import Workers from './pages/Workers';

// Reports Placeholder
const Reports = () => <Layout><h1 className="text-2xl font-bold">Business Reports</h1><p>Comprehensive reports coming soon...</p></Layout>;

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter>
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Owner Protected Routes */}
            <Route element={<ProtectedRoute roles={['owner']} />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/workers" element={<Workers />} />
            </Route>

            {/* Worker & Owner Protected Routes */}
            <Route element={<ProtectedRoute roles={['owner', 'worker']} />}>
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/bills-history" element={<BillsHistory />} />
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
