import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { getCache, setCache, TTL } from '../utils/cache';
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
import { format } from 'date-fns';
import JsBarcode from 'jsbarcode';
import html2pdf from 'html2pdf.js';

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
    const [showSuccess, setShowSuccess] = useState(false);
    const [lastBill, setLastBill] = useState(null);
    const barcodeRef = useRef(null);

    useEffect(() => {
        if (showSuccess && lastBill && barcodeRef.current) {
            JsBarcode(barcodeRef.current, lastBill.billId, {
                format: "CODE128",
                width: 1.5,
                height: 40,
                displayValue: true,
                fontSize: 10,
                margin: 0,
                background: "#ffffff",
                lineColor: "#000000"
            });
        }
    }, [showSuccess, lastBill]);

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
            
            // Set success data and show modal
            setLastBill({
                billId,
                customerName,
                customerPhone,
                items: cart.map(item => ({
                    productId: item.id,
                    productName: item.name,
                    quantity: item.cartQuantity,
                    unitPrice: item.price,
                    totalPrice: item.price * item.cartQuantity,
                    unit: item.unit
                })),
                subtotal,
                gstPercent,
                gstAmount,
                grandTotal,
                createdAt: new Date().toISOString(),
                workerName: userData?.name || 'Worker'
            });
            setShowSuccess(true);
            setShowConfirm(false);
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
                                            {(p.imageUrl || p.image_url) ? (
                                                <img 
                                                    src={p.imageUrl || p.image_url} 
                                                    alt={p.name}
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.style.display = 'none';
                                                        e.target.parentElement.innerHTML = '<div class="bg-slate-100 h-full w-full flex items-center justify-center text-slate-300"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z"></path></svg></div>';
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

            {/* Post-Success Actions & Preview */}
            {showSuccess && lastBill && (
                <div className="fixed inset-0 bg-primary/40 backdrop-blur-xl z-[200] flex flex-col items-center p-4 overflow-y-auto pt-20 no-scrollbar">
                    {/* Floating Controls */}
                    <div className="fixed top-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/90 backdrop-blur shadow-2xl p-2 rounded-2xl border border-slate-200 z-[210] animate-in slide-in-from-top-4 no-print">
                        <button 
                            onClick={() => window.print()} 
                            className="btn btn-primary h-12 px-6 gap-2 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20"
                        >
                            <Printer size={16} /> Print Bill
                        </button>
                        <button 
                            onClick={() => {
                                const element = document.getElementById('printable-bill');
                                html2pdf().from(element).save(`${lastBill.billId}.pdf`);
                            }} 
                            className="btn btn-accent h-12 px-6 gap-2 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-accent/20"
                        >
                            <Download size={16} /> Save PDF
                        </button>
                        <div className="w-px h-6 bg-slate-200 mx-1" />
                        <button 
                            onClick={() => {
                                setCart([]);
                                setCustomerName('');
                                setCustomerPhone('');
                                setShowSuccess(false);
                                setLastBill(null);
                            }} 
                            className="btn bg-emerald-500 text-white hover:bg-emerald-600 h-12 px-8 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-500/20"
                        >
                            Finish & New Bill
                        </button>
                    </div>

                    {/* Bill Preview Wrapper */}
                    <div className="w-full max-w-4xl bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200 mb-20 printable-area-wrapper">
                        <div id="printable-bill" className="p-12 bg-white min-h-[10in]">
                            {/* Header */}
                            <div className="flex flex-col items-center text-center space-y-4 pb-8 border-b-4 border-primary">
                                <div className="space-y-1">
                                    <h1 className="text-5xl font-black text-primary tracking-tighter italic uppercase">{settings.shop_name || 'PV ENTERPRISES'}</h1>
                                    <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">{settings.shop_address}</p>
                                </div>
                                <div className="flex items-center gap-6 text-[10px] font-black text-slate-400">
                                    <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-accent" /> {settings.shop_phone}</span>
                                    <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-accent" /> GST: {settings.gst_number || 'N/A'}</span>
                                </div>
                            </div>

                            {/* Info Section */}
                            <div className="py-8 grid grid-cols-2 gap-12 font-medium border-b border-slate-100">
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <span className="text-[10px] uppercase font-black text-slate-300 tracking-widest">Customer Details</span>
                                        <h2 className="text-xl font-black text-primary uppercase">{lastBill.customerName}</h2>
                                        <p className="text-sm font-bold text-slate-400">{lastBill.customerPhone || 'NO PHONE ATTACHED'}</p>
                                    </div>
                                </div>
                                <div className="text-right space-y-4">
                                    <div className="space-y-1">
                                        <span className="text-[10px] uppercase font-black text-slate-300 tracking-widest">Bill Reference</span>
                                        <h2 className="text-xl font-black text-indigo-600 font-mono">{lastBill.billId}</h2>
                                        <p className="text-sm font-bold text-slate-400">{format(new Date(lastBill.createdAt), 'dd MMM yyyy, hh:mm a')}</p>
                                    </div>
                                    <div className="text-[10px] font-black text-slate-300 uppercase italic">Sold At BACHUPALLY - Served BY: {lastBill.workerName}</div>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="py-8">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b-2 border-slate-900">
                                            <th className="py-4 text-xs font-black uppercase tracking-widest">#</th>
                                            <th className="py-4 text-xs font-black uppercase tracking-widest">Item Description</th>
                                            <th className="py-4 text-center text-xs font-black uppercase tracking-widest">Qty</th>
                                            <th className="py-4 text-right text-xs font-black uppercase tracking-widest">Rate</th>
                                            <th className="py-4 text-right text-xs font-black uppercase tracking-widest">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lastBill.items.map((item, idx) => (
                                            <tr key={idx} className="border-b border-slate-50 font-medium">
                                                <td className="py-4 text-slate-400">{idx + 1}</td>
                                                <td className="py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-800">{item.productName}</span>
                                                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black">REF: {item.productId.slice(0, 8)}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 text-center font-bold text-slate-600">{item.quantity} {item.unit}</td>
                                                <td className="py-4 text-right text-slate-600">₹{item.unitPrice.toLocaleString('en-IN')}</td>
                                                <td className="py-4 text-right font-black text-primary">₹{item.totalPrice.toLocaleString('en-IN')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Totals */}
                            <div className="flex justify-end py-8">
                                <div className="w-80 space-y-3">
                                    <div className="flex justify-between text-sm font-medium text-slate-500">
                                        <span>Subtotal</span>
                                        <span>₹{lastBill.subtotal.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-medium text-slate-500 pb-3 border-b border-slate-100">
                                        <span>GST ({lastBill.gstPercent}%)</span>
                                        <span>₹{lastBill.gstAmount.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between pt-3">
                                        <span className="text-sm font-black uppercase text-slate-800 tracking-tighter italic">GRAND TOTAL</span>
                                        <span className="text-2xl font-black text-primary">₹{lastBill.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="mt-20 pt-12 border-t-2 border-slate-900 border-dashed text-center space-y-8">
                                <div className="space-y-2">
                                    <p className="text-lg font-black text-primary tracking-[0.2em] italic uppercase">Authentic Parts • Supreme Service</p>
                                    <p className="text-[10px] font-bold text-slate-400 px-20">This is a system generated invoice. Please retain this bill for your service history. Goods once sold are not eligible for cash refunds. Contact support for part warranties.</p>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    <canvas ref={barcodeRef}></canvas>
                                    <p className="text-[8px] font-mono font-black text-slate-400 opacity-50 uppercase tracking-widest">{lastBill.billId}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Billing;
