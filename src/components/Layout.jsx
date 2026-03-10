import React from 'react';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { Bell, Search, User } from 'lucide-react';

const Layout = ({ children }) => {
    const { userData } = useAuth();
    
    return (
        <div className="flex min-h-screen bg-slate-50">
            <Sidebar />
            <main className="flex-1 lg:pl-64 flex flex-col min-w-0 h-screen overflow-hidden">
                {/* Global Header */}
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10 sticky top-0">
                    <div className="flex items-center flex-1 max-w-md bg-slate-100 rounded-lg px-3 py-2 border border-slate-200 focus-within:ring-2 focus-within:ring-accent focus-within:bg-white transition-all shadow-sm">
                        <Search size={18} className="text-slate-400 mr-2" />
                        <input 
                            type="text" 
                            placeholder="Quick search products or bills..." 
                            className="bg-transparent border-none outline-none text-sm w-full placeholder-slate-400"
                        />
                    </div>

                    <div className="flex items-center gap-6 ml-4">
                        <button className="relative p-2 text-slate-500 hover:text-accent transition-all hover:bg-slate-100 rounded-full">
                            <Bell size={20} />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white shadow-sm ring-2 ring-red-500 animate-pulse"></span>
                        </button>
                        
                        <div className="flex items-center gap-3">
                            <div className="hidden sm:block text-right">
                                <p className="text-sm font-semibold text-primary">{userData?.name}</p>
                                <p className="text-[10px] text-slate-400 uppercase tracking-widest">{userData?.role}</p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-navy-900 flex items-center justify-center text-white shadow-md border-2 border-white">
                                <User size={20} />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-8 scroll-smooth pb-20">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
