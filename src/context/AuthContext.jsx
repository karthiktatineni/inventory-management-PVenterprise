import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

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
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            roleData = userDoc.data();
          }
        } catch (error) {
          console.warn("Firestore access denied, using email fallback logic.");
        }

        if (!roleData) {
          // Emergency fallback for specific testing emails
          const email = user.email.toLowerCase();
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
