import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase';
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
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'shopConfig')
        .single();

      if (data && !error) {
        const mapped = {
          shopName: data.shop_name,
          shopAddress: data.shop_address,
          shopPhone: data.shop_phone,
          gstNumber: data.gst_number,
          gstPercent: Number(data.gst_percent),
          lowStockGlobalThreshold: Number(data.low_stock_global_threshold),
          ownerEmail: data.owner_email,
          telegramBotToken: data.telegram_bot_token,
          telegramChatId: data.telegram_chat_id,
          initialSetupDone: true
        };
        setSettings(mapped);
        setCache('settings', mapped, TTL.SETTINGS);
      }
      setLoading(false);
    };

    fetchSettings();

    const channel = supabase
      .channel('public:settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: 'id=eq.shopConfig' }, fetchSettings)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);

