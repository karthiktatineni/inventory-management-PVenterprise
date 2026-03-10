import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { supabase } from '../supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        let roleData = null;
        try {
          // Fetch role data from Supabase instead of Firestore
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.uid)
            .single();

          if (data && !error) {
            roleData = data;
          } else if (error) {
             console.warn("Supabase profile get error:", error.message);
          }
        } catch (error) {
          console.warn("Supabase access denied or error:", error.message);
        }

        if (!roleData) {
          // Emergency fallback for specific testing emails
          const email = user.email ? user.email.toLowerCase() : '';
          if (email === 'owner@gmail.com') {
            roleData = { name: 'Shop Owner', email, role: 'owner' };
          } else if (email === 'worker@gmail.com') {
            roleData = { name: 'Shop Worker', email, role: 'worker' };
          }
        }
        setUserData(roleData);
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    userData,
    loading,
    isAdmin: userData?.role === 'owner',
    isWorker: userData?.role === 'worker'
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
