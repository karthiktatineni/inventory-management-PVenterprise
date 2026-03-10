import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { 
  LayoutDashboard, 
  Package, 
  Receipt, 
  History, 
  Settings, 
  Users, 
  LogOut, 
  Bell, 
  Menu, 
  X,
  PlusCircle,
  BarChart2
} from 'lucide-react';
import { auth } from '../firebase';
import toast from 'react-hot-toast';

const Sidebar = () => {
    const { userData, isAdmin } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await auth.signOut();
            toast.success('Logged out successfully');
            navigate('/login');
        } catch (error) {
            toast.error('Logout failed');
        }
    };

    const ownerLinks = [
        { name: 'Main Panel', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
        { name: 'Stock & Add Products', path: '/inventory', icon: <Package size={20} /> },
        { name: 'Create Bill', path: '/billing', icon: <Receipt size={20} /> },
        { name: 'Review Bills', path: '/bills-history', icon: <History size={20} /> },
        { name: 'Reports', path: '/reports', icon: <BarChart2 size={20} /> },
        { name: 'Workers', path: '/workers', icon: <Users size={20} /> },
        { name: 'Settings', path: '/settings', icon: <Settings size={20} /> },
    ];

    const workerLinks = [
        { name: 'Stock View', path: '/inventory', icon: <Package size={20} /> },
        { name: 'Create Bill', path: '/billing', icon: <Receipt size={20} /> },
        { name: 'My Bills', path: '/bills-history', icon: <History size={20} /> },
    ];

    const links = isAdmin ? ownerLinks : workerLinks;

    return (
        <>
            {/* Mobile Toggle */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-primary text-white rounded-md no-print"
            >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Sidebar Overlay */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <div className={`fixed inset-y-0 left-0 w-64 bg-primary text-slate-300 z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} sidebar no-print`}>
                <div className="p-6">
                    <h2 className="text-xl font-bold text-white mb-1">PV Enterprises</h2>
                    <p className="text-xs text-slate-400">Inventory Management System</p>
                    <div className="mt-4 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white font-bold">
                            {userData?.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium text-white truncate">{userData?.name}</p>
                            <span className="text-xs capitalize px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                {userData?.role}
                            </span>
                        </div>
                    </div>
                </div>

                <nav className="mt-6 px-3 space-y-1">
                    {links.map((link) => (
                        <NavLink
                            key={link.path}
                            to={link.path}
                            onClick={() => setIsOpen(false)}
                            className={({ isActive }) => 
                                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                                    isActive 
                                    ? 'bg-accent text-white shadow-lg' 
                                    : 'hover:bg-navy-800 hover:text-white'
                                }`
                            }
                        >
                            {link.icon}
                            {link.name}
                        </NavLink>
                    ))}
                </nav>

                <div className="absolute bottom-0 left-0 w-full p-6 bg-navy-900">
                    <button 
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-all"
                    >
                        <LogOut size={20} />
                        Logout
                    </button>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
