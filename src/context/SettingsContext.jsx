import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
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
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'shopConfig'), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data());
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
