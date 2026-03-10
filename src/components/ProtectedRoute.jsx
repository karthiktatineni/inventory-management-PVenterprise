import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from './Layout';

export const ProtectedLayout = () => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

export const RoleRoute = ({ roles }) => {
  const { userData, loading } = useAuth();

  if (loading) return null;

  if (roles && !roles.includes(userData?.role)) {
    return <Navigate to={userData?.role === 'owner' ? "/dashboard" : "/inventory"} replace />;
  }

  return <Outlet />;
};

export default ProtectedLayout;
