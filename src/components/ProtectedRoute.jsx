import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ roles }) => {
  const { user, userData, loading } = useAuth();

  if (loading) return <div>Loading...</div>; // TODO: Better loader

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(userData?.role)) {
    return <Navigate to={userData?.role === 'owner' ? "/dashboard" : "/billing"} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
