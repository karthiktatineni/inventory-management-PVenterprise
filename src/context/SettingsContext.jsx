import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { getCache, setCache, TTL } from '../utils/cache';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(() => {
    // Serve cached settings immediately if available (avoids loading flash)
    const cached = getCache('settings');
    return cached || {
      shopName: 'PV Enterprises',
      shopAddress: 'Shop No G-1 JBS Towers, Bachupally, Hyderabad',
      shopPhone: '7893008877',
      gstNumber: '',
      gstPercent: 18,
      lowStockGlobalThreshold: 20,
      telegramBotToken: '',
      telegramChatId: '',
      ownerEmail: '',
      initialSetupDone: false
    };
  });
  const [loading, setLoading] = useState(!getCache('settings'));

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'shopConfig'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSettings(data);
        setCache('settings', data, TTL.SETTINGS); // cache for 10 minutes
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);

