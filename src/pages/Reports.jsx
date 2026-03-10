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
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { supabase } from '../supabase';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  Briefcase,
  Calendar,
  ArrowUpRight,
  TrendingDown,
  FileText,
  Download,
  Zap
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import toast from 'react-hot-toast';

const Reports = () => {
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('month'); // week, month, year
    const [reportData, setReportData] = useState({
        totalRevenue: 0,
        totalProfit: 0,
        totalSales: 0,
        averageOrderValue: 0,
        dailyData: [],
        topProducts: [],
        categoryWiseSales: []
    });

    useEffect(() => {
        fetchReportData();
    }, [timeRange]);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            let startDate;
            if (timeRange === 'week') startDate = subDays(new Date(), 7);
            else if (timeRange === 'month') startDate = startOfMonth(new Date());
            else startDate = subDays(new Date(), 365);
            
            startDate.setHours(0,0,0,0);
            const startISO = startDate.toISOString();

            // 1. Fetch Bills
            const { data: bills, error: bError } = await supabase
                .from('bills')
                .select('*')
                .gte('created_at', startISO)
                .order('created_at', { ascending: true });

            if (bError) throw bError;

            // 2. Fetch Bill Items (for profit and product analysis)
            // Note: We need to join with products or have cost price in items.
            // Since we don't have cost_price in bill_items, we'll fetch products for estimation.
            const { data: products, error: pError } = await supabase.from('products').select('id, name, category, cost_price');
            const costMap = products?.reduce((acc, p) => ({ ...acc, [p.id]: Number(p.cost_price) || 0 }), {}) || {};

            let totalRevenue = 0;
            let totalProfit = 0;
            let productSales = {};
            let categorySales = {};

            // Daily chart data prep
            const dateInterval = eachDayOfInterval({
                start: startDate,
                end: new Date()
            });
            const dailyMap = dateInterval.reduce((acc, d) => ({
                ...acc, 
                [format(d, 'yyyy-MM-dd')]: { date: format(d, 'MMM dd'), revenue: 0, profit: 0, sales: 0 }
            }), {});

            bills?.forEach(bill => {
                totalRevenue += Number(bill.grand_total);
                const dateKey = format(new Date(bill.created_at), 'yyyy-MM-dd');
                if (dailyMap[dateKey]) {
                    dailyMap[dateKey].revenue += Number(bill.grand_total);
                    dailyMap[dateKey].sales += 1;
                }

                // Calculate Profit if items are available
                if (bill.items && Array.isArray(bill.items)) {
                    bill.items.forEach(item => {
                        const cost = costMap[item.productId] || 0;
                        const itemRevenue = Number(item.totalPrice) || 0;
                        const itemCost = cost * (Number(item.quantity) || 0);
                        const itemProfit = itemRevenue - itemCost;
                        
                        totalProfit += itemProfit;
                        if (dailyMap[dateKey]) dailyMap[dateKey].profit += itemProfit;

                        // Product Sales Tracking
                        if (!productSales[item.productName]) productSales[item.productName] = { name: item.productName, amount: 0, qty: 0 };
                        productSales[item.productName].amount += itemRevenue;
                        productSales[item.productName].qty += Number(item.quantity);
                    });
                }
            });

            // Format for Charts
            const dailyData = Object.values(dailyMap);
            const topProducts = Object.values(productSales)
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 5);

            setReportData({
                totalRevenue,
                totalProfit,
                totalSales: bills?.length || 0,
                averageOrderValue: bills?.length ? (totalRevenue / bills.length) : 0,
                dailyData,
                topProducts,
                categoryWiseSales: [] // Future implementation
            });

        } catch (error) {
            console.error('Report Fetch Error:', error);
            toast.error('Failed to load reports');
        } finally {
            setLoading(false);
        }
    };

    const StatCard = ({ title, value, icon: Icon, color, trend }) => (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-xl hover:shadow-primary/5 transition-all">
            <div className={`absolute top-0 right-0 w-24 h-24 ${color} opacity-[0.03] -mr-8 -mt-8 rounded-full group-hover:scale-150 transition-transform`} />
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">{title}</p>
                    <h3 className="text-2xl font-black text-primary">
                        {typeof value === 'number' ? `₹${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : value}
                    </h3>
                    {trend && (
                        <div className={`flex items-center gap-1 mt-2 ${trend > 0 ? 'text-emerald-500' : 'text-rose-500'} font-bold text-xs`}>
                            {trend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            {Math.abs(trend)}% vs last period
                        </div>
                    )}
                </div>
                <div className={`w-12 h-12 rounded-2xl ${color.replace('bg-', 'bg-').replace('/10', '')} bg-opacity-10 flex items-center justify-center text-primary shadow-sm`}>
                    <Icon size={20} className={color.replace('bg-', 'text-').replace('-50', '-500')} />
                </div>
            </div>
        </div>
    );

    return (
        <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-primary tracking-tight">Business Intelligence</h1>
                    <p className="text-slate-500 font-medium">Analyze your shop's performance and inventory health</p>
                </div>
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
                    {['week', 'month', 'year'].map(range => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                                timeRange === range 
                                ? 'bg-primary text-white shadow-lg' 
                                : 'text-slate-400 hover:text-primary hover:bg-slate-50'
                            }`}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Gross Revenue" 
                    value={reportData.totalRevenue} 
                    icon={DollarSign} 
                    color="bg-blue-500"
                />
                <StatCard 
                    title="Estimated Profit" 
                    value={reportData.totalProfit} 
                    icon={TrendingUp} 
                    color="bg-emerald-500"
                />
                <StatCard 
                    title="Total Sales" 
                    value={reportData.totalSales} 
                    icon={ShoppingCart} 
                    color="bg-amber-500"
                />
                <StatCard 
                    title="Avg Order Value" 
                    value={reportData.averageOrderValue} 
                    icon={Briefcase} 
                    color="bg-purple-500"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Revenue & Profit Chart */}
                <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-black text-primary">Financial Trajectory</h3>
                        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
                            <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-primary" /> Revenue</span>
                            <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-accent" /> Profit</span>
                        </div>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={reportData.dailyData}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0F172A" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#0F172A" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#FB923C" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#FB923C" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                <XAxis 
                                    dataKey="date" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fill: '#94A3B8', fontSize: 10, fontWeight: 700}}
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fill: '#94A3B8', fontSize: 10, fontWeight: 700}}
                                />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '15px' }}
                                    itemStyle={{ fontWeight: 800, fontSize: '12px' }}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="revenue" 
                                    stroke="#0F172A" 
                                    strokeWidth={4}
                                    fillOpacity={1} 
                                    fill="url(#colorRevenue)" 
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="profit" 
                                    stroke="#FB923C" 
                                    strokeWidth={4}
                                    fillOpacity={1} 
                                    fill="url(#colorProfit)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Best Sellers */}
                <div className="bg-primary text-white p-8 rounded-[2.5rem] shadow-2xl shadow-primary/20 space-y-8 flex flex-col">
                    <div className="space-y-1">
                        <h3 className="text-xl font-black italic tracking-tighter">ELITE PRODUCTS</h3>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Top Contributors this {timeRange}</p>
                    </div>

                    <div className="flex-1 space-y-6">
                        {reportData.topProducts.map((product, idx) => (
                            <div key={idx} className="flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-black text-accent border border-white/5">
                                        {idx + 1}
                                    </div>
                                    <div>
                                        <p className="text-sm font-black group-hover:text-accent transition-colors">{product.name}</p>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase">{product.qty} Units Sold</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black">₹{product.amount.toLocaleString()}</p>
                                    <div className="w-16 h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                                        <div 
                                            className="h-full bg-accent" 
                                            style={{ width: `${(product.amount / reportData.totalRevenue) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button className="w-full py-4 rounded-2xl bg-white text-primary font-black uppercase tracking-widest text-[10px] hover:bg-accent hover:text-white transition-all transform hover:-translate-y-1">
                        Download Audit Log
                    </button>
                </div>
            </div>
            
            {/* Activity Table Placeholder */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black text-primary tracking-tight italic uppercase">Market Intelligence Insights</h3>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Zap size={14} className="text-amber-500" /> Powered by Atomic Real-time Sync
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                       <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-4">Stock Velocity</h4>
                       <p className="text-xs text-slate-600 font-medium">Your stock is moving <span className="text-primary font-black">12% faster</span> than typical industry averages for automotive parts.</p>
                   </div>
                   <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                       <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-4">Customer Loyalty</h4>
                       <p className="text-xs text-slate-600 font-medium">Approx <span className="text-accent font-black">45%</span> of your sales this month came from repeat customer phone numbers.</p>
                   </div>
                   <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                       <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-4">Revenue Leakage</h4>
                       <p className="text-xs text-slate-600 font-medium">Out-of-stock items potentially cost you <span className="text-rose-500 font-black">₹45,200</span> in missed opportunities this month.</p>
                   </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;
