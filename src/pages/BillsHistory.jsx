import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  where,
  deleteDoc,
  doc,
  runTransaction,
  increment,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { getCache, setCache, TTL } from '../utils/cache';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { 
  Search, 
  Filter, 
  Printer, 
  Trash2, 
  Calendar, 
  Eye, 
  FileText, 
  User, 
  Phone, 
  Receipt,
  Download,
  Barcode as BarcodeIcon,
  X,
  CreditCard,
  History
} from 'lucide-react';
import toast from 'react-hot-toast';
import JsBarcode from 'jsbarcode';
import html2pdf from 'html2pdf.js';
import { useSearchParams } from 'react-router-dom';

const BillsHistory = () => {
    const { isAdmin } = useAuth();
    const { settings } = useSettings();
    const [searchParams] = useSearchParams();
    
    const [bills, setBills] = useState(() => getCache('bills') || []);
    const [loading, setLoading] = useState(!getCache('bills'));
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBill, setSelectedBill] = useState(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    
    const barcodeRef = useRef(null);

    useEffect(() => {
        const q = query(collection(db, 'bills'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setBills(items);
            setCache('bills', items, TTL.BILLS);  // cache for 1 minute
            setLoading(false);

            // Handle URL redirect for new bill
            const billIdParam = searchParams.get('ref');
            if (billIdParam) {
                const found = items.find(b => b.billId === billIdParam);
                if (found) {
                    setSelectedBill(found);
                    setIsViewModalOpen(true);
                }
            }
        });
        return () => unsub();
    }, [searchParams]);

    useEffect(() => {
        if (selectedBill && barcodeRef.current) {
            JsBarcode(barcodeRef.current, selectedBill.billId, {
                format: "CODE128",
                width: 2,
                height: 40,
                displayValue: true,
                fontSize: 12,
                margin: 0
            });
        }
    }, [selectedBill, isViewModalOpen]);

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = () => {
        const element = document.getElementById('printable-bill');
        const opt = {
            margin: 10,
            filename: `${selectedBill.billId}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().from(element).set(opt).save();
    };

    const handleDeleteBill = async (bill) => {
        if (!isAdmin) return;
        
        const reverseStock = window.confirm(`Delete bill ${bill.billId}? Reversing stock for ${bill.items.length} items...`);
        if (!reverseStock) return;

        try {
            await runTransaction(db, async (transaction) => {
                // 1. Get each product linked to this bill
                for (const item of bill.items) {
                    const productRef = doc(db, 'products', item.productId);
                    transaction.update(productRef, {
                        quantity: increment(item.quantity),
                        updatedAt: serverTimestamp()
                    });
                }
                
                // 2. Delete the bill
                const billRef = doc(db, 'bills', bill.id);
                transaction.delete(billRef);
            });
            toast.success('Bill deleted and stock reversed');
            setIsViewModalOpen(false);
        } catch (error) {
            console.error(error);
            toast.error('Error deleting bill');
        }
    };

    const filteredBills = bills.filter(b => 
        b.billId.toLowerCase().includes(searchTerm.toLowerCase()) || 
        b.customerName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatDate = (ts) => {
        if (!ts) return '';
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-3xl font-black text-primary tracking-tight">Bill History</h1>
                    <p className="text-slate-500 font-medium">View and manage all generated invoices</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm leading-none ring-4 ring-slate-50">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        className="input pl-10 h-12"
                        placeholder="Search by Bill ID or Customer Name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-3 px-3 overflow-x-auto no-scrollbar">
                   <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg text-xs font-bold text-slate-500 whitespace-nowrap">
                        <Calendar size={14} className="text-primary" /> Filter Date Range (Coming Soon)
                   </div>
                </div>
            </div>

            <div className="card border-none shadow-xl shadow-slate-200/50">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-tighter">Reference ID</th>
                                <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-tighter">Date & Time</th>
                                <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-tighter">Customer Info</th>
                                <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-tighter text-center">Items</th>
                                <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-tighter text-right">Total Amount</th>
                                <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-tighter text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan="6" className="py-20 text-center text-slate-300">Loading history...</td></tr>
                            ) : filteredBills.length === 0 ? (
                                <tr><td colSpan="6" className="py-20 text-center italic text-slate-300">No bills found</td></tr>
                            ) : filteredBills.map((b) => (
                                <tr key={b.id} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="px-6 py-4">
                                        <span className="font-mono text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded ring-1 ring-indigo-100">{b.billId}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs font-bold text-slate-500">{formatDate(b.createdAt)}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                                <User size={14} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm text-primary">{b.customerName}</span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase">{b.customerPhone || 'NO PHONE'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center font-black text-slate-700">
                                        {b.items.length}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="text-primary font-black">₹{b.grandTotal.toLocaleString('en-IN')}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-end gap-2 opacity-10 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => { setSelectedBill(b); setIsViewModalOpen(true); }}
                                                className="btn btn-outline p-2 h-auto text-indigo-600 hover:bg-indigo-50 border-none"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            <button 
                                                onClick={() => { setSelectedBill(b); window.print(); }}
                                                className="btn btn-outline p-2 h-auto text-emerald-600 hover:bg-emerald-50 border-none"
                                            >
                                                <Printer size={18} />
                                            </button>
                                            {isAdmin && (
                                                <button 
                                                    onClick={() => handleDeleteBill(b)}
                                                    className="btn btn-outline p-2 h-auto text-red-500 hover:bg-red-50 border-none"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bill Preview Modal */}
            {isViewModalOpen && selectedBill && (
                <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-[150] flex items-center justify-center p-4 overflow-y-auto no-print">
                    <div className="bg-slate-100/50 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                        {/* Header Controls */}
                        <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center z-10 sticky top-0">
                            <div className="flex gap-2">
                                <button onClick={handlePrint} className="btn btn-primary gap-2 h-10 px-6 font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">
                                    <Printer size={16} /> Print Bill
                                </button>
                                <button onClick={handleDownloadPDF} className="btn btn-accent gap-2 h-10 px-6 font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-accent/20">
                                    <Download size={16} /> Save PDF
                                </button>
                            </div>
                            <button onClick={() => { setIsViewModalOpen(false); setSelectedBill(null); }} className="p-3 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Printable Area */}
                        <div className="flex-1 overflow-y-auto bg-slate-500/20 p-8 flex justify-center">
                            <div 
                                id="printable-bill"
                                className="bg-white w-[210mm] min-h-[297mm] p-12 shadow-2xl relative border border-slate-300 print:shadow-none print:border-none print:w-full print:m-0"
                            >
                                {/* Shop Header */}
                                <div className="text-center pb-8 border-b-2 border-slate-900 space-y-2">
                                    <h1 className="text-5xl font-black uppercase tracking-tighter text-primary">{settings.shopName || 'PV ENTERPRISES'}</h1>
                                    <p className="font-bold text-slate-500 text-sm max-w-sm mx-auto">{settings.shopAddress}</p>
                                    <div className="flex justify-center gap-6 mt-4 font-black uppercase tracking-widest text-[10px] text-slate-400">
                                        <div className="flex items-center gap-1"><Phone size={12} className="text-accent" /> {settings.shopPhone}</div>
                                        <div className="flex items-center gap-1"><CreditCard size={12} className="text-accent" /> GST: {settings.gstNumber || 'N/A'}</div>
                                    </div>
                                </div>

                                <div className="py-8 grid grid-cols-2 gap-12 font-medium border-b border-slate-100">
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <span className="text-[10px] uppercase font-black text-slate-300 tracking-widest">Customer Details</span>
                                            <h2 className="text-xl font-black text-primary uppercase">{selectedBill.customerName}</h2>
                                            <p className="text-sm font-bold text-slate-400">{selectedBill.customerPhone || 'NO PHONE ATTACHED'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right space-y-4">
                                        <div className="space-y-1">
                                            <span className="text-[10px] uppercase font-black text-slate-300 tracking-widest">Bill Reference</span>
                                            <h2 className="text-xl font-black text-indigo-600 font-mono">{selectedBill.billId}</h2>
                                            <p className="text-sm font-bold text-slate-400">{formatDate(selectedBill.createdAt)}</p>
                                        </div>
                                        <div className="text-[10px] font-black text-slate-300 uppercase">Served BY: {selectedBill.workerName}</div>
                                    </div>
                                </div>

                                {/* Table */}
                                <div className="py-8">
                                    <table className="w-full text-left border-collapse">
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
                                            {selectedBill.items.map((item, idx) => (
                                                <tr key={idx} className="border-b border-slate-50 font-medium">
                                                    <td className="py-4 text-slate-400">{idx + 1}</td>
                                                    <td className="py-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-slate-800">{item.productName}</span>
                                                            <span className="text-[10px] text-slate-400">CAT: ACC-ITEM-{idx}</span>
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
                                            <span>₹{selectedBill.subtotal.toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="flex justify-between text-sm font-medium text-slate-500 pb-3 border-b border-slate-100">
                                            <span>GST ({selectedBill.gstPercent}%)</span>
                                            <span>₹{selectedBill.gstAmount.toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="flex justify-between pt-3">
                                            <span className="text-sm font-black uppercase text-slate-800 tracking-tighter">Grand Total</span>
                                            <span className="text-2xl font-black text-primary">₹{selectedBill.grandTotal.toLocaleString('en-IN')}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="mt-auto pt-12 border-t-2 border-slate-900 border-dashed text-center space-y-6">
                                    <div className="space-y-1">
                                        <p className="text-sm font-black text-primary tracking-widest uppercase">Thank you for your business!</p>
                                        <p className="text-[10px] font-bold text-slate-300">Goods once sold cannot be returned. Please check before leaving.</p>
                                    </div>
                                    
                                    <div className="flex flex-col items-center gap-2">
                                        <canvas ref={barcodeRef}></canvas>
                                        <p className="text-[8px] font-mono font-bold text-slate-400">ELECTRONICALLY GENERATED INVOICE - {selectedBill.billId}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BillsHistory;
