import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { getCache, setCache, invalidateCache, TTL } from '../utils/cache';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  History, 
  AlertTriangle,
  PackageCheck,
  PackageOpen,
  X,
  ArrowUpDown,
  FileDown
} from 'lucide-react';
import toast from 'react-hot-toast';

const Inventory = () => {
    const { isAdmin } = useAuth();
    const { settings } = useSettings();
    const [products, setProducts] = useState(() => getCache('products') || []);
    const [loading, setLoading] = useState(!getCache('products'));
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [sortField, setSortField] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [imageFile, setImageFile] = useState(null);

    // Form states
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        sku: '',
        price: '',
        costPrice: '',
        quantity: '',
        unit: 'pcs',
        lowStockThreshold: 20
    });

    useEffect(() => {
        setLoading(true);
        const fetchProducts = async () => {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order(sortField === 'costPrice' ? 'cost_price' : sortField === 'lowStockThreshold' ? 'low_stock_threshold' : sortField, 
                { ascending: sortOrder === 'asc' });

            if (error) {
                console.error('Inventory Fetch Error:', error);
                toast.error(`Error loading products: ${error.message}`);
                setLoading(false);
                return;
            }
            
            // Map snake_case from Supabase to camelCase for JS
            const mapped = (data || []).map(p => ({
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
            setLoading(false);
        };

        fetchProducts();

        // Real-time subscription
        const channel = supabase
            .channel('public:products')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
                fetchProducts();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [sortField, sortOrder]);

    const uploadToSupabase = async (file) => {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `product_images/${fileName}`;

            const bucket = 'products'; // Reverting to 'products' as per setup guide for consistency
            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(filePath, file);

            if (uploadError) {
                console.error('Supabase upload error:', uploadError);
                toast.error(`Supabase Error: ${uploadError.message}`);
                return null;
            }

            const { data } = supabase.storage
                .from(bucket)
                .getPublicUrl(filePath);

            return data.publicUrl;
        } catch (error) {
            console.error('Supabase upload catch:', error);
            toast.error(`Image upload failed: ${error.message}`);
            return null;
        }
    };

    const handleAddProduct = async (e) => {
        e.preventDefault();
        try {
            let finalImageUrl = formData.imageUrl || '';
            
            if (imageFile) {
                toast.loading('Uploading image to Supabase...', { id: 'img-upload' });
                const uploadedUrl = await uploadToSupabase(imageFile);
                if (uploadedUrl) finalImageUrl = uploadedUrl;
                toast.dismiss('img-upload');
            }

            const newProduct = {
                name: formData.name,
                category: formData.category,
                sku: formData.sku,
                price: Number(formData.price) || 0,
                cost_price: Number(formData.costPrice) || 0,
                quantity: Number(formData.quantity) || 0,
                unit: formData.unit || 'pcs',
                low_stock_threshold: Number(formData.lowStockThreshold) || 20,
                image_url: finalImageUrl || '',
                updated_at: new Date().toISOString()
            };
            
            console.log('Sending to Supabase:', newProduct);
            const { error } = await supabase.from('products').insert([newProduct]);

            if (error) throw error;

            toast.success('Product added successfully');
            setIsAddModalOpen(false);
            resetForm();
            invalidateCache('products'); 
        } catch (error) {
            toast.dismiss('img-upload');
            console.error('Add product error:', error);
            toast.error(`Supabase Error: ${error.message}`);
        }
    };

    const handleEditProduct = async (e) => {
        e.preventDefault();
        try {
            let finalImageUrl = formData.imageUrl;
            
            if (imageFile) {
                toast.loading('Uploading image to Supabase...', { id: 'img-upload-edit' });
                const uploadedUrl = await uploadToSupabase(imageFile);
                if (uploadedUrl) finalImageUrl = uploadedUrl;
                toast.dismiss('img-upload-edit');
            }

            const updatedProduct = {
                name: formData.name,
                category: formData.category,
                sku: formData.sku,
                price: Number(formData.price) || 0,
                cost_price: Number(formData.costPrice) || 0,
                quantity: Number(formData.quantity) || 0,
                unit: formData.unit || 'pcs',
                low_stock_threshold: Number(formData.lowStockThreshold) || 20,
                image_url: finalImageUrl || '',
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('products')
                .update(updatedProduct)
                .eq('id', editingProduct.id);

            if (error) throw error;

            toast.success('Product updated successfully');
            setIsEditModalOpen(false);
            setEditingProduct(null);
            resetForm();
            invalidateCache('products');
        } catch (error) {
            toast.dismiss('img-upload-edit');
            console.error('Edit product error:', error);
            toast.error(`Supabase Error: ${error.message}`);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this product?')) {
            try {
                const { error } = await supabase
                    .from('products')
                    .delete()
                    .eq('id', id);

                if (error) throw error;
                toast.success('Product deleted');
                invalidateCache('products');
            } catch (error) {
                toast.error(`Error deleting product: ${error.message}`);
            }
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            category: '',
            sku: '',
            price: '',
            costPrice: '',
            quantity: '',
            unit: 'pcs',
            lowStockThreshold: 20,
            imageUrl: ''
        });
        setImageFile(null);
    };

    const getStatusBadge = (qty, threshold) => {
        const low = threshold || settings.lowStockGlobalThreshold || 20;
        if (qty === 0) return <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold ring-1 ring-red-400">Out of Stock</span>;
        if (qty <= low) return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs font-bold ring-1 ring-amber-400">Low Stock</span>;
        return <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-bold ring-1 ring-emerald-400">In Stock</span>;
    };

    const categories = ['All', ...new Set(products.filter(p => p.category).map(p => p.category))];

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             p.sku.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || p.category.toLowerCase() === categoryFilter.toLowerCase();
        return matchesSearch && matchesCategory;
    });

    const toggleSort = (field) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-3xl font-black text-primary tracking-tight">Inventory</h1>
                    <p className="text-slate-500 font-medium">Manage and track your products</p>
                </div>
                {isAdmin && (
                    <div className="flex gap-2">
                         <button 
                            className="btn btn-outline gap-2"
                            onClick={() => {/* CSV Import Logic */ toast.loading('Coming soon...')}}
                        >
                            <FileDown size={18} /> Import CSV
                        </button>
                        <button 
                            onClick={() => { resetForm(); setIsAddModalOpen(true); }}
                            className="btn btn-accent gap-2 shadow-lg shadow-orange-100 hover:scale-105 active:scale-95 transition-all"
                        >
                            <Plus size={20} /> Add Product
                        </button>
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-slate-200">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        className="input pl-10 h-11"
                        placeholder="Search by name or SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <select 
                        className="input pl-10 h-11 appearance-none cursor-pointer capitalize"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                        {categories.map(c => <option key={c} value={c?.toLowerCase() || ''}>{c}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                    <div className="flex-1 text-xs font-bold text-slate-500 uppercase tracking-widest pl-2">Quick Filters</div>
                    <button className="text-xs font-bold px-2 py-1 rounded bg-white border border-slate-200 hover:border-accent hover:text-accent transition-all">Low Stock</button>
                    <button className="text-xs font-bold px-2 py-1 rounded bg-white border border-slate-200 hover:border-red-400 hover:text-red-500 transition-all">Out of Stock</button>
                </div>
            </div>

            {/* Table */}
            <div className="card border-none shadow-xl shadow-slate-200/50">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 border-b border-slate-100">
                            <tr>
                                <th onClick={() => toggleSort('sku')} className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group">
                                    <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-500 tracking-tighter">
                                        SKU <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-tighter">Img</th>
                                <th onClick={() => toggleSort('name')} className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group">
                                    <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-500 tracking-tighter">
                                        Product Name <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-tighter">Category</th>
                                <th onClick={() => toggleSort('quantity')} className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group text-center">
                                    <div className="flex items-center justify-center gap-2 text-xs font-black uppercase text-slate-500 tracking-tighter">
                                        Stock <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </th>
                                <th onClick={() => toggleSort('price')} className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group text-right">
                                    <div className="flex items-center justify-end gap-2 text-xs font-black uppercase text-slate-500 tracking-tighter">
                                        Price <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-tighter text-center">Status</th>
                                {isAdmin && <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-tighter text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-20 text-center">
                                        <div className="flex animate-pulse items-center justify-center gap-3">
                                            <div className="w-6 h-6 bg-slate-200 rounded-full"></div>
                                            <div className="text-slate-400 font-medium">Fetching inventory data...</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <PackageOpen size={48} className="text-slate-200" />
                                            <p className="text-slate-400 font-medium">No products match your criteria</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredProducts.map((p) => (
                                <tr key={p.id} className="hover:bg-slate-50/80 transition-all duration-200 group">
                                    <td className="px-6 py-4">
                                        <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">{p.sku}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {p.imageUrl ? (
                                            <img src={p.imageUrl} alt={p.name} className="w-12 h-12 object-cover rounded-lg shadow-sm" />
                                        ) : (
                                            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-300">
                                                <History size={16} />
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-800 text-sm group-hover:text-primary transition-colors">{p.name}</span>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{p.unit}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs font-bold text-slate-500 bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full ring-1 ring-indigo-100">{p.category}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center font-black text-slate-700">
                                        {p.quantity}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-primary">₹ {p.price.toLocaleString('en-IN')}</span>
                                            {isAdmin && <span className="text-[10px] text-slate-400 font-medium line-through decoration-slate-300">₹ {p.costPrice.toLocaleString('en-IN')}</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {getStatusBadge(p.quantity, p.lowStockThreshold)}
                                    </td>
                                    {isAdmin && (
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-1 opacity-10 group-hover:opacity-100 transition-all">
                                                <button 
                                                    onClick={() => {
                                                        setEditingProduct(p);
                                                        setFormData(p);
                                                        setIsEditModalOpen(true);
                                                    }}
                                                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(p.id)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal for Add/Edit */}
            {(isAddModalOpen || isEditModalOpen) && (
                <div className="fixed inset-0 bg-primary/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-8 py-6 bg-primary text-white flex justify-between items-center bg-gradient-to-r from-primary to-navy-900">
                            <div>
                                <h2 className="text-xl font-black tracking-tight">{isAddModalOpen ? 'Add New Product' : 'Edit Product'}</h2>
                                <p className="text-xs text-slate-300 font-medium mt-1">Fill in the product details below</p>
                            </div>
                            <button onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); setEditingProduct(null); }} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={isAddModalOpen ? handleAddProduct : handleEditProduct} className="p-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-2">Product Name</label>
                                        <input required className="input bg-slate-50 border-slate-100 focus:bg-white" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Brake Pad Set" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-2">Category</label>
                                        <input required className="input bg-slate-50 border-slate-100 focus:bg-white" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="e.g. Brakes" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-1">SKU Code</label>
                                        <input required className="input bg-slate-50 border-slate-100 focus:bg-white" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} placeholder="PV-BRK-001" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-1">Quantity</label>
                                            <input type="number" required className="input h-10" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-1">Unit</label>
                                            <select className="input h-10" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})}>
                                                <option value="pcs">Pieces</option>
                                                <option value="set">Set</option>
                                                <option value="pair">Pair</option>
                                                <option value="ltr">Litre</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-1">Selling Price (₹)</label>
                                        <input type="number" required className="input border-accent/20 focus:ring-accent font-bold text-lg" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-1">Cost Price (₹)</label>
                                        <input type="number" required className="input" value={formData.costPrice} onChange={e => setFormData({...formData, costPrice: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-1 pl-1">Product Photo</label>
                                        <input 
                                            type="file"
                                            accept="image/*"
                                            className="input bg-slate-50 border-slate-100 focus:bg-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" 
                                            onChange={e => setImageFile(e.target.files[0])} 
                                        />
                                        {formData.imageUrl && !imageFile && (
                                            <p className="text-[10px] font-bold text-slate-400 mt-2">Currently has an image. Uploading a new one will replace it.</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-1">Low Stock Alert at</label>
                                        <div className="flex items-center gap-3">
                                            <input type="number" className="input flex-1" value={formData.lowStockThreshold} onChange={e => setFormData({...formData, lowStockThreshold: e.target.value})} />
                                            <span className="text-xs font-bold text-slate-400">units</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-10 flex gap-4">
                                <button type="button" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }} className="flex-1 btn btn-outline h-12 font-bold uppercase tracking-widest text-xs">Cancel</button>
                                <button type="submit" className="flex-[2] btn btn-accent h-12 font-bold uppercase tracking-widest text-xs shadow-lg shadow-orange-100">{isAddModalOpen ? 'Create Product' : 'Save Changes'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
