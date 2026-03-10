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

    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState([]);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'products'), (snapshot) => {
            setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsub();
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
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
        const counterRef = doc(db, 'counters', 'daily');
        
        // Use a transaction to increment the counter and get unique ID
        const billCount = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let count = 1;
            
            if (counterDoc.exists() && counterDoc.data().date === today) {
                count = counterDoc.data().count + 1;
                transaction.update(counterRef, { count: count });
            } else {
                transaction.set(counterRef, { date: today, count: 1 });
            }
            return count;
        });

        const paddedCount = billCount.toString().padStart(4, '0');
        return `AUTO-${today}-${paddedCount}`;
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
            
            await runTransaction(db, async (transaction) => {
                // 1. Check stock for all items
                const itemDocs = [];
                for (const item of cart) {
                    const productRef = doc(db, 'products', item.id);
                    const productSnap = await transaction.get(productRef);
                    if (!productSnap.exists()) throw new Error(`Product ${item.name} not found`);
                    if (productSnap.data().quantity < item.cartQuantity) {
                        throw new Error(`Insufficient stock for ${item.name}`);
                    }
                    itemDocs.push({ ref: productRef, data: productSnap.data(), cartQty: item.cartQuantity });
                }

                // 2. Create bill record
                const billData = {
                    billId,
                    customerName,
                    customerPhone,
                    workerName: userData.name,
                    workerId: userData.uid,
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
                    createdAt: serverTimestamp(),
                };
                
                const billRef = doc(db, 'bills', billId);
                transaction.set(billRef, billData);

                // 3. Update stock & check for low stock
                for (const item of itemDocs) {
                    const newQty = item.data.quantity - item.cartQty;
                    transaction.update(item.ref, { 
                        quantity: newQty,
                        updatedAt: serverTimestamp()
                    });

                    // Potential for low stock notification trigger
                    if (newQty <= (item.data.lowStockThreshold || settings.lowStockGlobalThreshold || 20)) {
                        const notifRef = doc(collection(db, 'notifications'));
                        transaction.set(notifRef, {
                            type: 'low_stock',
                            productId: item.ref.id,
                            productName: item.data.name,
                            currentQty: newQty,
                            sentAt: serverTimestamp(),
                            channels: ['telegram', 'email'],
                            read: false
                        });
                    }
                }
            });

            toast.success('Bill generated successfully!');
            navigate(`/bills-history?ref=${billId}`); // Redirect to history/print view
        } catch (error) {
            console.error(error);
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
        <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-12rem)]">
            {/* Product Selection Side */}
            <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 shrink-0">
                    <h1 className="text-3xl font-black text-primary tracking-tight mb-2">Billing System</h1>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input 
                            className="input pl-12 h-14 text-lg font-bold border-2 focus:border-accent bg-slate-50"
                            placeholder="Search product name or scan SKU barcode..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 overflow-hidden max-h-80 overflow-y-auto ring-4 ring-primary/5">
                                {searchResults.map(p => (
                                    <button 
                                        key={p.id}
                                        onClick={() => addToCart(p)}
                                        className="w-full text-left p-4 hover:bg-slate-50 flex justify-between items-center transition-all group"
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-bold text-primary group-hover:text-accent transition-colors">{p.name}</span>
                                            <span className="text-xs font-bold text-slate-400">SKU: {p.sku} | Unit: {p.unit}</span>
                                        </div>
                                        <div className="text-right flex items-center gap-4">
                                            <div className="flex flex-col items-end">
                                                <span className="font-black text-primary">₹{p.price.toLocaleString('en-IN')}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.quantity > 5 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                                    {p.quantity} in stock
                                                </span>
                                            </div>
                                            <Plus size={20} className="text-accent opacity-0 group-hover:opacity-100 transition-all" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Cart Table */}
                <div className="flex-1 card overflow-hidden flex flex-col min-h-0 bg-white shadow-xl shadow-slate-200/50">
                    <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-2">
                             <ShoppingCart size={18} className="text-accent" />
                             <h2 className="text-sm font-black uppercase text-slate-500 tracking-tighter">Billing Cart</h2>
                        </div>
                        <span className="bg-primary text-white text-[10px] font-black px-2 py-0.5 rounded-full ring-2 ring-primary/20">
                            {cart.length} ITEMS
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-6">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                                < Receipt size={64} strokeWidth={1} />
                                <p className="font-bold text-sm uppercase tracking-widest">Your cart is empty</p>
                            </div>
                        ) : (
                            <table className="w-full text-left">
                                <thead className="sticky top-0 bg-white py-4 z-10 border-b border-slate-50">
                                    <tr className="text-[10px] uppercase font-black text-slate-400 tracking-widest">
                                        <th className="py-4">Item Details</th>
                                        <th className="py-4 text-center">Qty</th>
                                        <th className="py-4 text-right">Unit Price</th>
                                        <th className="py-4 text-right">Total</th>
                                        <th className="py-4 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cart.map(item => (
                                        <tr key={item.id} className="border-b border-slate-50 group hover:bg-slate-50/50 transition-colors">
                                            <td className="py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm text-primary">{item.name}</span>
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase">{item.sku}</span>
                                                </div>
                                            </td>
                                            <td className="py-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => updateCartQty(item.id, -1)} className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-500"><Minus size={14} /></button>
                                                    <span className="w-8 text-center font-black text-primary">{item.cartQuantity}</span>
                                                    <button onClick={() => updateCartQty(item.id, 1)} className="p-1 hover:bg-black hover:text-white rounded transition-colors text-slate-500"><Plus size={14} /></button>
                                                </div>
                                            </td>
                                            <td className="py-4 text-right font-medium text-slate-600">₹{item.price.toLocaleString('en-IN')}</td>
                                            <td className="py-4 text-right font-black text-primary">₹{(item.price * item.cartQuantity).toLocaleString('en-IN')}</td>
                                            <td className="py-4 text-right">
                                                <button onClick={() => removeFromCart(item.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
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
            <div className="w-full lg:w-96 flex flex-col gap-6">
                {/* Customer Details */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                    <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                        <User size={14} className="text-accent" /> Customer Details
                    </h3>
                    <div className="space-y-3">
                        <div className="relative">
                            <input 
                                className="input h-11 pl-4 font-bold placeholder:font-medium placeholder:text-slate-300"
                                placeholder="FullName / Customer Name *"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                             <input 
                                className="input h-11 pl-4 font-bold placeholder:font-medium placeholder:text-slate-300"
                                placeholder="Phone Number (Optional)"
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Summary & Action */}
                <div className="bg-primary text-white p-8 rounded-3xl shadow-2xl shadow-primary/20 space-y-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Bill Summary</h3>
                    
                    <div className="space-y-4 font-medium text-slate-300">
                        <div className="flex justify-between items-center text-sm">
                            <span>Subtotal</span>
                            <span className="text-white">₹{subtotal.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span>GST ({gstPercent}%)</span>
                            <span className="text-white">₹{gstAmount.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                            <span className="text-xs uppercase font-black text-slate-400">Total Payable</span>
                            <span className="text-3xl font-black text-white">₹{grandTotal.toLocaleString('en-IN')}</span>
                        </div>
                    </div>

                    <button 
                        disabled={loading || cart.length === 0}
                        onClick={() => setShowConfirm(true)}
                        className="w-full btn btn-accent h-16 text-lg font-black uppercase tracking-widest shadow-xl shadow-orange-900/20 hover:scale-[1.02] active:scale-95 transition-all text-white disabled:opacity-50 disabled:scale-100"
                    >
                        {loading ? 'Processing...' : 'Generate Bill'}
                    </button>
                    
                    <p className="text-[10px] text-center text-slate-500 font-bold uppercase tracking-widest">Atomic Firestore Transaction Enabled</p>
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 bg-primary/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 border-8 border-slate-50">
                        <div className="p-10 text-center space-y-6">
                            <div className="w-24 h-24 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-orange-50 animate-bounce">
                                <AlertCircle size={48} />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-primary tracking-tight">Finalize Bill?</h2>
                                <p className="text-slate-500 font-medium mt-2">Sure you want to generate bill for <span className="text-primary font-bold">₹{grandTotal.toLocaleString('en-IN')}</span>? This action is immutable and will deduct stock.</p>
                            </div>
                            
                            <div className="flex flex-col gap-3">
                                <button 
                                    onClick={handleCreateBill}
                                    className="w-full btn btn-primary h-14 text-sm font-black uppercase tracking-widest shadow-lg"
                                >
                                    Yes, Create & Print
                                </button>
                                <button 
                                    onClick={() => setShowConfirm(false)}
                                    className="w-full btn btn-outline h-14 text-sm font-black uppercase tracking-widest border-2"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Billing;
