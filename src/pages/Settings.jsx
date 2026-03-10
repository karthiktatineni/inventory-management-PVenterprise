import React, { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { db, storage } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { supabase } from '../supabase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  Building2, 
  MapPin, 
  PhoneCall, 
  Percent, 
  Send, 
  BellRing, 
  Mail, 
  UserPlus, 
  Upload,
  CheckCircle2,
  Trash2,
  X,
  CreditCard,
  Target,
  Bot
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const Settings = () => {
    const { settings, loading: settingsLoading } = useSettings();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({ ...settings });

    const handleUpdateSettings = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const dbData = {
                id: 'shopConfig',
                shop_name: formData.shopName,
                shop_address: formData.shopAddress,
                shop_phone: formData.shopPhone,
                gst_number: formData.gstNumber,
                gst_percent: formData.gstPercent,
                low_stock_global_threshold: formData.lowStockGlobalThreshold,
                owner_email: formData.ownerEmail,
                telegram_bot_token: formData.telegramBotToken,
                telegram_chat_id: formData.telegramChatId,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('settings')
                .upsert(dbData);

            if (error) throw error;
            toast.success('Shop settings updated successfully');
        } catch (error) {
            console.error('Settings Update Error:', error);
            toast.error(`Error updating settings: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleTestTelegram = async () => {
        if (!formData.telegramBotToken || !formData.telegramChatId) {
            toast.error('Bot Token and Chat ID are required');
            return;
        }

        toast.loading('Sending test message...');
        try {
            const message = `✅ TEST NOTIFICATION — [PV Enterprises]\nTelegram Alert Connection Successful!`;
            const url = `https://api.telegram.org/bot${formData.telegramBotToken}/sendMessage`;
            await axios.post(url, {
                chat_id: formData.telegramChatId,
                text: message
            });
            toast.dismiss();
            toast.success('Telegram Test Successful!');
        } catch (error) {
            toast.dismiss();
            toast.error('Telegram Test Failed. Check Token/ID.');
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-50 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none"></div>
                <div className="z-10">
                    <h1 className="text-4xl font-black text-primary tracking-tighter">Shop Settings</h1>
                    <p className="text-slate-500 font-bold mt-2 flex items-center gap-2">
                        <Target size={18} className="text-accent" /> Configure business profile & automation
                    </p>
                </div>
                <div className="flex gap-4 z-10">
                   <div className="w-20 h-20 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 hover:border-accent hover:text-accent transition-all cursor-pointer group">
                        <Upload size={24} className="group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black mt-1">LOGO</span>
                   </div>
                </div>
            </div>

            <form onSubmit={handleUpdateSettings} className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Visual Identity & Basic Info */}
                <div className="card p-10 space-y-10 group">
                    <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                        <div className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg transform group-hover:rotate-12 transition-transform">
                            <Building2 size={24} />
                        </div>
                        <div>
                           <h3 className="text-lg font-black text-primary tracking-tight">Business Profile</h3>
                           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Basic Identity</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="relative group/field">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1 pl-1">Shop Name</label>
                            <input 
                                className="input h-14 bg-slate-50 border-slate-100 group-focus-within/field:bg-white group-focus-within/field:border-accent font-black text-primary text-lg" 
                                value={formData.shopName}
                                onChange={e => setFormData({ ...formData, shopName: e.target.value })}
                            />
                            <div className="absolute right-4 top-[2.4rem] text-slate-300">
                                <CheckCircle2 size={18} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="relative">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1 pl-1">Contact Phone</label>
                                <div className="flex items-center bg-slate-50 rounded-lg p-1.5 border border-slate-100 focus-within:ring-2 ring-accent focus-within:bg-white transition-all">
                                    <div className="bg-white p-2.5 rounded-md shadow-sm text-slate-400"><PhoneCall size={18} /></div>
                                    <input 
                                        className="bg-transparent border-none outline-none flex-1 px-3 font-bold text-slate-600"
                                        value={formData.shopPhone}
                                        onChange={e => setFormData({ ...formData, shopPhone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="relative">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1 pl-1">Owner Email</label>
                                <div className="flex items-center bg-slate-50 rounded-lg p-1.5 border border-slate-100 focus-within:ring-2 ring-accent focus-within:bg-white transition-all">
                                    <div className="bg-white p-2.5 rounded-md shadow-sm text-slate-400"><Mail size={18} /></div>
                                    <input 
                                        className="bg-transparent border-none outline-none flex-1 px-3 font-bold text-slate-600 lowercase"
                                        value={formData.ownerEmail}
                                        onChange={e => setFormData({ ...formData, ownerEmail: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="relative">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1 pl-1">Full Business Address</label>
                            <div className="flex items-start bg-slate-50 rounded-lg p-1.5 border border-slate-100 focus-within:ring-2 ring-accent focus-within:bg-white transition-all">
                                <div className="bg-white p-2.5 rounded-md shadow-sm text-slate-400"><MapPin size={18} /></div>
                                <textarea 
                                    rows="3"
                                    className="bg-transparent border-none outline-none flex-1 px-3 py-2 font-bold text-slate-600 text-sm leading-relaxed"
                                    value={formData.shopAddress}
                                    onChange={e => setFormData({ ...formData, shopAddress: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tax & Threshold Settings */}
                <div className="card p-10 space-y-10 group">
                    <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                        <div className="w-12 h-12 bg-indigo-500 text-white rounded-2xl flex items-center justify-center shadow-lg transform group-hover:rotate-12 transition-transform">
                            <CreditCard size={24} />
                        </div>
                        <div>
                           <h3 className="text-lg font-black text-primary tracking-tight">Financial & Alerts</h3>
                           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Taxation & Monitoring</p>
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="relative">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1 pl-1">GST Identification No.</label>
                                <input 
                                    className="input h-14 bg-indigo-50 border-indigo-100 focus:bg-white font-black text-indigo-700 tracking-widest"
                                    placeholder="22AAAAA0000A1Z5"
                                    value={formData.gstNumber}
                                    onChange={e => setFormData({ ...formData, gstNumber: e.target.value })}
                                />
                            </div>
                            <div className="relative">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1 pl-1">Default GST %</label>
                                <div className="flex items-center bg-indigo-50 rounded-lg p-1.5 border border-indigo-100 focus-within:ring-2 ring-indigo-500 focus-within:bg-white transition-all">
                                    <div className="bg-indigo-500 p-2.5 rounded-md shadow-sm text-white"><Percent size={18} strokeWidth={3} /></div>
                                    <input 
                                        type="number"
                                        className="bg-transparent border-none outline-none flex-1 px-4 font-black text-indigo-700 text-xl"
                                        value={formData.gstPercent}
                                        onChange={e => setFormData({ ...formData, gstPercent: Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-amber-50 rounded-[2rem] p-8 border-2 border-dashed border-amber-200 space-y-4">
                             <div className="flex items-center gap-2">
                                <BellRing className="text-amber-500" size={18} />
                                <h4 className="text-xs font-black uppercase text-amber-700 tracking-widest">Global Stock Monitoring</h4>
                             </div>
                             <p className="text-[11px] font-bold text-amber-600/80 leading-snug">Set the default inventory quantity that triggers low stock alerts across all products unless overridden individually.</p>
                             <div className="flex items-center gap-4 pt-2">
                                <input 
                                    type="range" 
                                    min="0" max="100" 
                                    className="flex-1 accent-amber-500 h-2 bg-amber-200 rounded-full appearance-none cursor-pointer"
                                    value={formData.lowStockGlobalThreshold}
                                    onChange={e => setFormData({ ...formData, lowStockGlobalThreshold: Number(e.target.value) })}
                                />
                                <span className="w-16 h-12 bg-white rounded-xl flex items-center justify-center font-black text-amber-600 shadow-sm border border-amber-100">{formData.lowStockGlobalThreshold}</span>
                             </div>
                        </div>
                    </div>
                </div>

                {/* Automation & Integrations */}
                <div className="lg:col-span-2 card p-10 space-y-10 group">
                    <div className="flex items-center justify-between border-b border-slate-50 pb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-500 text-white rounded-2xl flex items-center justify-center shadow-lg transform group-hover:-rotate-12 transition-transform">
                                <Bot size={24} />
                            </div>
                            <div>
                            <h3 className="text-lg font-black text-primary tracking-tight">Telegram Bot Automation</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Instant Alert Integration</p>
                            </div>
                        </div>
                        <button 
                            type="button" 
                            onClick={handleTestTelegram}
                            className="btn btn-outline gap-2 h-11 px-6 font-black uppercase tracking-widest text-[10px] border-2 border-blue-100 hover:border-blue-500 hover:bg-blue-50 text-blue-600 transition-all rounded-xl"
                        >
                            <Send size={14} /> Send Test Alert
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-6">
                            <div className="relative">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1 pl-1">Telegram Bot Token (HTTP API)</label>
                                <input 
                                    type="password"
                                    className="input h-14 bg-blue-50 border-blue-100 focus:bg-white font-mono text-sm tracking-tighter"
                                    placeholder="1234567890:ABCdefGHI..."
                                    value={formData.telegramBotToken}
                                    onChange={e => setFormData({ ...formData, telegramBotToken: e.target.value })}
                                />
                            </div>
                            <div className="relative">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1 pl-1">Target Chat ID</label>
                                <input 
                                    className="input h-14 bg-blue-50 border-blue-100 focus:bg-white font-black text-primary"
                                    placeholder="-100xxxxxxxxx"
                                    value={formData.telegramChatId}
                                    onChange={e => setFormData({ ...formData, telegramChatId: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 flex flex-col justify-center">
                            <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-4">How to setup?</h5>
                            <ol className="text-xs font-bold text-slate-500 space-y-3">
                                <li className="flex gap-2">
                                    <span className="w-5 h-5 bg-white rounded-full flex items-center justify-center border border-slate-200 shrink-0">1</span>
                                    <span>Create a bot via @BotFather on Telegram.</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="w-5 h-5 bg-white rounded-full flex items-center justify-center border border-slate-200 shrink-0">2</span>
                                    <span>Copy the <span className="text-blue-600">API Token</span> and paste it here.</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="w-5 h-5 bg-white rounded-full flex items-center justify-center border border-slate-200 shrink-0">3</span>
                                    <span>Add bot to your group and invite @IDBot to get Chat ID.</span>
                                </li>
                            </ol>
                        </div>
                    </div>
                </div>

                {/* Form Action */}
                <div className="lg:col-span-2 pt-6 flex justify-end gap-6">
                     <button type="button" className="btn btn-outline h-16 px-12 font-black uppercase tracking-widest text-xs border-2 text-slate-400">Discard Changes</button>
                     <button 
                        disabled={loading}
                        type="submit" 
                        className="btn btn-accent h-16 px-16 font-black uppercase tracking-widest text-xs shadow-2xl shadow-orange-500/20"
                    >
                        {loading ? 'Synchronizing...' : 'Save Configuration'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Settings;
