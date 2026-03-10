import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  runTransaction, 
  doc, 
  serverTimestamp,
  getDoc,
  setDoc,
  increment
} from 'firebase/firestore';
import { db, rtdb } from '../firebase';
import { supabase } from '../supabase';
import { getCache, setCache, TTL } from '../utils/cache';
import { ref, get, set, runTransaction as runRtdbTransaction } from 'firebase/database';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  User, 
  Phone, 
  Receipt,
  Printer,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const Billing = () => {
    const { userData } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();

    const [products, setProducts] = useState(() => getCache('products') || []);
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState([]);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => {
        const fetchProducts = async () => {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('name', { ascending: true });

            if (data && !error) {
                const mapped = data.map(p => ({
                    id: p.id,
                    name: p.name,
                    category: p.category,
                    sku: p.sku,
                    price: Number(p.price),
                    costPrice: Number(p.cost_price),
                    quantity: Number(p.quantity),
                    unit: p.unit,
                    lowStockThreshold: Number(p.low_stock_threshold),
                    imageUrl: p.image_url,
                    createdAt: p.created_at,
                    updatedAt: p.updated_at
                }));
                setProducts(mapped);
                setCache('products', mapped, TTL.PRODUCTS);
            }
        };

        fetchProducts();

        const channel = supabase
            .channel('public:products_billing')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
                fetchProducts();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const addToCart = (product) => {
        const existing = cart.find(item => item.id === product.id);
        if (existing) {
            if (existing.cartQuantity + 1 > product.quantity) {
                toast.error(`Only ${product.quantity} units available`);
                return;
            }
            setCart(cart.map(item => 
                item.id === product.id 
                ? { ...item, cartQuantity: item.cartQuantity + 1 } 
                : item
            ));
        } else {
            if (product.quantity < 1) {
                toast.error('Out of stock');
                return;
            }
            setCart([...cart, { ...product, cartQuantity: 1 }]);
        }
        setSearchTerm('');
    };

    const updateCartQty = (id, delta) => {
        setCart(cart.map(item => {
            if (item.id === id) {
                const newQty = item.cartQuantity + delta;
                const original = products.find(p => p.id === id);
                if (newQty > original.quantity) {
                    toast.error(`Max ${original.quantity} available`);
                    return item;
                }
                if (newQty < 1) return item;
                return { ...item, cartQuantity: newQty };
            }
            return item;
        }).filter(item => item.cartQuantity > 0));
    };

    const removeFromCart = (id) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.cartQuantity), 0);
    const gstPercent = settings.gstPercent || 18;
    const gstAmount = (subtotal * gstPercent) / 100;
    const grandTotal = subtotal + gstAmount;

    const generateBillId = async () => {
        const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const dateIdFormat = todayStr.replace(/-/g, ''); // YYYYMMDD
        
        // Count bills from today to get unique increment
        const { count, error } = await supabase
            .from('bills')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', todayStr);

        const billCount = (count || 0) + 1;
        const paddedCount = billCount.toString().padStart(4, '0');
        return `AUTO-${dateIdFormat}-${paddedCount}`;
    };

    const handleCreateBill = async () => {
        if (!customerName) {
            toast.error('Customer Name is required');
            return;
        }
        if (cart.length === 0) {
            toast.error('Cart is empty');
            return;
        }

        setLoading(true);
        try {
            const billId = await generateBillId();
            
            // Call the Atomic Supabase RPC (Postgres Function)
            const { error: rpcError } = await supabase.rpc('create_bill_v2', {
                p_bill_id: billId,
                p_customer_name: customerName,
                p_customer_phone: customerPhone,
                p_worker_name: userData?.name || 'Worker',
                p_worker_id: userData?.id || userData?.uid || '', 
                p_items: cart.map(item => ({
                    productId: item.id,
                    productName: item.name,
                    quantity: item.cartQuantity,
                    unitPrice: item.price,
                    totalPrice: item.price * item.cartQuantity,
                    unit: item.unit
                })),
                p_subtotal: Number(subtotal) || 0,
                p_gst_percent: Number(gstPercent) || 0,
                p_gst_amount: Number(gstAmount) || 0,
                p_grand_total: Number(grandTotal) || 0
            });

            if (rpcError) throw rpcError;

            toast.success('Bill generated successfully!');
            invalidateCache('products'); // Refresh local inventory
            navigate(`/bills-history?ref=${billId}&print=true`); 
        } catch (error) {
            console.error('Billing Error:', error);
            toast.error(error.message || 'Error generating bill');
        } finally {
            setLoading(false);
            setShowConfirm(false);
        }
    };

    const searchResults = products.filter(p => 
        (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.sku.toLowerCase().includes(searchTerm.toLowerCase())) &&
        searchTerm.length > 0
    );

    return (
        <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-140px)] min-h-0 overflow-hidden pb-4">
            {/* Product Selection Side */}
            <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0">
                <div className="flex-[2] bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col min-h-0 overflow-hidden">
                    <div className="flex justify-between items-center mb-3">
                        <h1 className="text-xl font-black text-primary tracking-tight">Select Items</h1>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{products.length} In Inventory</span>
                    </div>
                    {/* ... Search ... */}
                    <div className="relative mb-4 shrink-0">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            className="input pl-12 h-11 text-sm font-bold border-2 focus:border-accent bg-slate-50 w-full"
                            placeholder="Find product..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    {/* Products Grid - Optimized for High Density (India Mart Style) */}
                    <div className="flex-1 overflow-y-auto pr-2 -mr-2 scrollbar-thin scrollbar-thumb-slate-200">
                        {products.length === 0 && !loading ? (
                            <div className="h-full flex items-center justify-center text-slate-300">
                                <p className="font-bold text-[10px] uppercase tracking-widest">No products in inventory</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 2xl:grid-cols-6 gap-2 pb-6">
                                {(searchTerm ? searchResults : products).map(p => (
                                    <div 
                                        key={p.id}
                                        onClick={() => addToCart(p)}
                                        className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-accent hover:shadow-lg transition-all group flex flex-col"
                                    >
                                        {/* Compact Image */}
                                        <div className="aspect-square bg-slate-50 relative overflow-hidden flex items-center justify-center">
                                            {p.imageUrl ? (
                                                <img 
                                                    src={p.imageUrl} 
                                                    alt={p.name}
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = '';
                                                        e.target.style.display = 'none';
                                                        e.target.parentElement.innerHTML = '<div class="bg-slate-100 h-full w-full flex items-center justify-center"><svg class="text-slate-300" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z"></path><path d="M16 8h-4l-1 5h4"></path><path d="M16 16h-9"></path></svg></div>';
                                                    }}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                />
                                            ) : (
                                                <div className="bg-slate-100 w-full h-full flex items-center justify-center">
                                                    <Receipt size={24} className="text-slate-300" />
                                                </div>
                                            )}
                                            <div className="absolute top-1 right-1">
                                                 <span className={`text-[7px] font-black px-1 py-0.5 rounded shadow-sm ${p.quantity > 5 ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white'}`}>
                                                    {p.quantity} {p.unit}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Ultra Compact Details */}
                                        <div className="p-2 space-y-0.5">
                                            <h3 className="font-bold text-primary text-[9px] leading-tight truncate group-hover:text-accent" title={p.name}>{p.name}</h3>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black text-primary">₹{(p.price || 0).toLocaleString()}</span>
                                                <Plus size={10} className="text-slate-200 group-hover:text-accent" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Cart Table */}
                <div className="flex-1 card overflow-hidden flex flex-col min-h-0 bg-white shadow-xl shadow-slate-200/50">
                    <div className="px-5 py-3 border-b border-slate-50 flex items-center justify-between bg-slate-50/50 shrink-0">
                        <div className="flex items-center gap-2">
                             <ShoppingCart size={16} className="text-accent" />
                             <h2 className="text-[10px] font-black uppercase text-slate-500 tracking-tighter">Billing Cart</h2>
                        </div>
                        <span className="bg-primary text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                            {cart.length} ITEMS
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-5">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-200 gap-2">
                                < Receipt size={48} strokeWidth={1} />
                                <p className="font-black text-[10px] uppercase tracking-widest">Cart Empty</p>
                            </div>
                        ) : (
                            <table className="w-full text-left">
                                <thead className="sticky top-0 bg-white py-2 z-10 border-b border-slate-50">
                                    <tr className="text-[8px] uppercase font-black text-slate-400 tracking-widest">
                                        <th className="py-3">Item</th>
                                        <th className="py-3 text-center">Qty</th>
                                        <th className="py-3 text-right">Unit</th>
                                        <th className="py-3 text-right">Total</th>
                                        <th className="py-3 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cart.map(item => (
                                        <tr key={item.id} className="border-b border-slate-50 group hover:bg-slate-50/50">
                                            <td className="py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-xs text-primary truncate max-w-[120px]">{item.name}</span>
                                                    <span className="text-[8px] text-slate-400 font-bold uppercase">{item.sku}</span>
                                                </div>
                                            </td>
                                            <td className="py-3">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={() => updateCartQty(item.id, -1)} className="p-1 hover:bg-slate-100 rounded text-slate-400"><Minus size={12} /></button>
                                                    <span className="w-6 text-center font-black text-xs text-primary">{item.cartQuantity}</span>
                                                    <button onClick={() => updateCartQty(item.id, 1)} className="p-1 hover:bg-black hover:text-white rounded text-slate-400"><Plus size={12} /></button>
                                                </div>
                                            </td>
                                            <td className="py-3 text-right text-xs text-slate-500">₹{item.price.toLocaleString()}</td>
                                            <td className="py-3 text-right font-black text-xs text-primary">₹{(item.price * item.cartQuantity).toLocaleString()}</td>
                                            <td className="py-3 text-right">
                                                <button onClick={() => removeFromCart(item.id)} className="p-1 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* Sidebar Checkout Panel */}
            <div className="w-full lg:w-80 flex flex-col gap-4 shrink-0 overflow-y-auto no-scrollbar pb-4">
                {/* Customer Details */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-3">
                    <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                        <User size={12} className="text-accent" /> Customer Details
                    </h3>
                    <div className="space-y-2">
                        <input 
                            className="input h-10 px-4 text-sm font-bold placeholder:text-slate-300 bg-slate-50"
                            placeholder="Customer Name *"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                        />
                         <input 
                            className="input h-10 px-4 text-sm font-bold placeholder:text-slate-300 bg-slate-50"
                            placeholder="Phone (Optional)"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                        />
                    </div>
                </div>

                {/* Summary & Action */}
                <div className="bg-primary text-white p-6 rounded-3xl shadow-2xl shadow-primary/20 space-y-5 flex flex-col">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Bill Summary</h3>
                    
                    <div className="space-y-2 font-bold text-slate-400 text-xs">
                        <div className="flex justify-between items-center">
                            <span>Subtotal</span>
                            <span className="text-white">₹{subtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span>GST ({gstPercent}%)</span>
                            <span className="text-white">₹{gstAmount.toLocaleString()}</span>
                        </div>
                        <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                            <span className="text-[10px] uppercase font-black">Total Payable</span>
                            <span className="text-2xl font-black text-white">₹{grandTotal.toLocaleString()}</span>
                        </div>
                    </div>

                    <button 
                        disabled={loading || cart.length === 0}
                        onClick={() => setShowConfirm(true)}
                        className="w-full btn btn-accent h-14 text-base font-black uppercase tracking-widest text-white disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : 'Generate Bill'}
                    </button>
                    
                    <p className="text-[9px] text-center text-slate-500 font-black uppercase tracking-widest">Atomic Supabase Transaction Enabled</p>
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 bg-primary/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden border-4 border-slate-50 p-8 text-center space-y-4">
                        <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto">
                            <AlertCircle size={32} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-primary">Finalize Bill?</h2>
                            <p className="text-slate-500 text-xs font-medium mt-1">Sure you want to create bill for <span className="text-primary font-black">₹{grandTotal.toLocaleString()}</span>?</p>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                            <button 
                                onClick={handleCreateBill}
                                className="w-full btn btn-primary h-12 text-xs font-black uppercase"
                            >
                                Yes, Create & Print
                            </button>
                            <button 
                                onClick={() => setShowConfirm(false)}
                                className="w-full btn btn-outline h-12 text-xs font-black uppercase"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Billing;
