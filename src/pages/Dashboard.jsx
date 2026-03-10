import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  orderBy, 
  limit,
  addDoc,
  serverTimestamp,
  setDoc,
  doc
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  TrendingUp, 
  Package, 
  Receipt, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight,
  ShoppingCart,
  DollarSign
} from 'lucide-react';
import { format, subDays, isSameDay } from 'date-fns';
import toast from 'react-hot-toast';

const Dashboard = () => {
    const [stats, setStats] = useState({
        totalProducts: 0,
        todayBills: 0,
        todayRevenue: 0,
        lowStockCount: 0,
        outOfStockCount: 0
    });
    const [revenueData, setRevenueData] = useState([]);
    const [recentBills, setRecentBills] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Real-time stats listener
        const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
            const items = snapshot.docs.map(doc => doc.data());
            const low = items.filter(i => i.quantity > 0 && i.quantity <= (i.lowStockThreshold || 20)).length;
            const out = items.filter(i => i.quantity === 0).length;
            setStats(prev => ({ ...prev, totalProducts: items.length, lowStockCount: low, outOfStockCount: out }));
        });

        // Today's stats
        const today = new Date();
        today.setHours(0,0,0,0);
        const qToday = query(collection(db, 'bills'), where('createdAt', '>=', today));
        const unsubToday = onSnapshot(qToday, (snapshot) => {
            const bills = snapshot.docs.map(doc => doc.data());
            const revenue = bills.reduce((sum, b) => sum + b.grandTotal, 0);
            setStats(prev => ({ ...prev, todayBills: bills.length, todayRevenue: revenue }));
        });

        // Last 7 days revenue
        const fetchChartData = async () => {
            const last7Days = Array.from({ length: 7 }, (_, i) => {
                const d = subDays(new Date(), i);
                return { date: format(d, 'MMM dd'), fullDate: d, amount: 0 };
            }).reverse();

            const start = subDays(new Date(), 7);
            start.setHours(0,0,0,0);
            const qChart = query(collection(db, 'bills'), where('createdAt', '>=', start));
            const snap = await getDocs(qChart);
            
            snap.docs.forEach(doc => {
                const data = doc.data();
                const bDate = data.createdAt.toDate();
                const dayMatch = last7Days.find(d => isSameDay(d.fullDate, bDate));
                if (dayMatch) dayMatch.amount += data.grandTotal;
            });
            
            setRevenueData(last7Days);
        };

    const unsubRecent = onSnapshot(query(collection(db, 'bills'), orderBy('createdAt', 'desc'), limit(5)), (snap) => {
            setRecentBills(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        fetchChartData();
        setLoading(false);

        return () => { unsubProducts(); unsubToday(); unsubRecent(); };
    }, []);

    const seedInitialData = async () => {
        const confirm = window.confirm("Populate inventory with PV Enterprises initial seed products and images? (5 items, 100 stock each)");
        if (!confirm) return;

        toast.loading('Seeding product database with images...');
        try {
            const products = [
                { name: "Premium Brake Pad Set", category: "Brakes", sku: "PV-BRK-001", price: 1250, costPrice: 850, quantity: 100, unit: "set", lowStockThreshold: 15, imageUrl: "/WhatsApp Image 2026-03-10 at 8.58.12 AM.jpeg" },
                { name: "Hydraulic Engine Oil 5W-40", category: "Lubricants", sku: "PV-OIL-002", price: 3400, costPrice: 2800, quantity: 100, unit: "ltr", lowStockThreshold: 10, imageUrl: "/WhatsApp Image 2026-03-10 at 8.58.13 AM.jpeg" },
                { name: "LED Fog Lamp Kit (H8)", category: "Lighting", sku: "PV-LIT-003", price: 2150, costPrice: 1250, quantity: 100, unit: "pair", lowStockThreshold: 20, imageUrl: "/WhatsApp Image 2026-03-10 at 8.58.13 AM (1).jpeg" },
                { name: "Premium Leather Seat Covers", category: "Interior", sku: "PV-INT-004", price: 12500, costPrice: 8500, quantity: 100, unit: "set", lowStockThreshold: 5, imageUrl: "/WhatsApp Image 2026-03-10 at 8.58.14 AM.jpeg" },
                { name: "Heavy Duty Suspension Bush", category: "Chassis", sku: "PV-SUS-005", price: 850, costPrice: 420, quantity: 100, unit: "pcs", lowStockThreshold: 25, imageUrl: "/WhatsApp Image 2026-03-10 at 8.58.14 AM (1).jpeg" }
            ];

            for (const p of products) {
                await addDoc(collection(db, 'products'), {
                    ...p,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            }

            // Seed settings too
            await setDoc(doc(db, 'settings', 'shopConfig'), {
                shopName: 'PV Enterprises',
                shopAddress: 'Shop No G-1 JBS Towers, Bachupally, Hyderabad',
                shopPhone: '7893008877',
                gstNumber: '36AAAAA0000A1Z5',
                gstPercent: 18,
                lowStockGlobalThreshold: 20,
                ownerEmail: 'owner@pventerprises.com'
            });

            toast.dismiss();
            toast.success('Inventory seeded successfully!');
        } catch (error) {
            toast.dismiss();
            toast.error('Seeding failed: Check Firestore Rules');
        }
    };

    const cards = [
        { title: 'Total Products', value: stats.totalProducts, icon: <Package size={24} />, color: 'bg-blue-500', trend: '+12%' },
        { title: 'Bills Today', value: stats.todayBills, icon: <Receipt size={24} />, color: 'bg-indigo-500', trend: '+5%' },
        { title: 'Revenue Today', value: `₹${stats.todayRevenue.toLocaleString('en-IN')}`, icon: <TrendingUp size={24} />, color: 'bg-emerald-500', trend: '+18%' },
        { title: 'Low Stock', value: stats.lowStockCount, icon: <AlertTriangle size={24} />, color: 'bg-amber-500', trend: 'Critical', alert: true },
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-black text-primary tracking-tight">Business Overview</h1>
                <p className="text-slate-500 font-medium">Real-time performance analytics for PV Enterprises</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card, i) => (
                    <div key={i} className="card p-6 relative overflow-hidden group hover:ring-2 ring-accent transition-all duration-300">
                        <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:scale-125 transition-transform duration-500`}>
                            {card.icon}
                        </div>
                        <p className="text-xs font-black uppercase text-slate-400 tracking-widest">{card.title}</p>
                        <h2 className="text-3xl font-black text-primary mt-2">{card.value}</h2>
                        <div className="mt-4 flex items-center justify-between">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded shadow-sm ${card.alert ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600 flex items-center gap-1'}`}>
                                {!card.alert && <ArrowUpRight size={10} />} {card.trend}
                            </span>
                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">Live Monitor</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Revenue Chart */}
                <div className="lg:col-span-2 card p-8 space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-black uppercase text-slate-500 tracking-widest">Revenue Last 7 Days</h3>
                        <div className="flex gap-2">
                            <span className="w-3 h-3 bg-accent rounded-full animate-pulse"></span>
                            <span className="text-[10px] font-bold text-slate-400">REALTIME</span>
                        </div>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={revenueData}>
                                <defs>
                                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#c2410c" stopOpacity={0.8} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="date" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                    tickFormatter={(val) => `₹${val/1000}k`}
                                />
                                <Tooltip 
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                    itemStyle={{ color: '#1e293b', fontWeight: 800, fontSize: '12px' }}
                                />
                                <Bar dataKey="amount" radius={[8, 8, 0, 0]} barSize={40} fill="url(#barGradient)" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent Billing Log */}
                <div className="card lg:col-span-1 flex flex-col">
                    <div className="p-6 border-b border-slate-50">
                        <h3 className="text-sm font-black uppercase text-slate-500 tracking-widest">Recent Activity</h3>
                    </div>
                    <div className="flex-1 p-6 space-y-6">
                        {recentBills.map((bill, i) => (
                            <div key={bill.id} className="flex items-center gap-4 group cursor-pointer hover:bg-slate-50 p-2 rounded-xl transition-all">
                                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-primary group-hover:bg-accent group-hover:text-white transition-all shadow-sm">
                                    <ShoppingCart size={20} />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <div className="flex justify-between items-start">
                                        <span className="font-bold text-sm text-primary truncate pr-2">{bill.customerName}</span>
                                        <span className="text-xs font-black text-slate-800">₹{bill.grandTotal.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-1">
                                        <span className="text-[10px] font-bold text-slate-400 font-mono tracking-tighter uppercase">{bill.billId}</span>
                                        <span className="text-[10px] font-bold text-slate-400 capitalize">{format(bill.createdAt.toDate(), 'hh:mm a')}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button className="p-4 bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest hover:text-accent transition-colors">View All Transactions</button>
                </div>
            </div>
            
            {/* Out of stock attention */}
            {stats.outOfStockCount > 0 && (
                <div className="bg-red-50 border-2 border-red-100 rounded-3xl p-8 flex items-center justify-between shadow-lg shadow-red-100/50">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-red-500 text-white rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
                            <AlertTriangle size={32} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-red-700 tracking-tight">Attention Required!</h3>
                            <p className="text-sm font-bold text-red-500/80">You have <span className="text-red-600 underline">{stats.outOfStockCount} items</span> currently out of stock. Customers cannot purchase these until restocked.</p>
                        </div>
                    </div>
                    <button onClick={() => {/* Navigate and filter */}} className="btn bg-red-600 text-white hover:bg-red-700 h-14 px-8 font-black uppercase tracking-widest text-xs">Restock Now</button>
                </div>
            )}

            {/* Quick Setup for Empty Store */}
            {stats.totalProducts === 0 && !loading && (
                <div className="bg-indigo-600 rounded-[2.5rem] p-12 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-48 -mt-48 blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                        <div className="w-24 h-24 bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur-md">
                            <Zap size={48} className="text-white animate-pulse" />
                        </div>
                        <div className="flex-1 space-y-2 text-center md:text-left">
                            <h2 className="text-3xl font-black tracking-tight">Setup Your Inventory</h2>
                            <p className="text-indigo-100 font-medium">Your shop is empty. Click below to populate the database with the initial 5 products and default PV Enterprises settings.</p>
                        </div>
                        <button 
                            onClick={seedInitialData}
                            className="btn bg-white text-indigo-600 hover:bg-indigo-50 h-16 px-10 font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all"
                        >
                            Seed Initial Stock
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
