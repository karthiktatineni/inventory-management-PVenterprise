import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { db, auth } from '../firebase';
import { getCache, setCache, invalidateCache, TTL } from '../utils/cache';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  ShieldCheck, 
  ShieldAlert, 
  Mail, 
  Lock, 
  User as UserIcon,
  X,
  UserCheck,
  Zap
} from 'lucide-react';
import toast from 'react-hot-toast';

const Workers = () => {
    const [workers, setWorkers] = useState(() => getCache('workers') || []);
    const [loading, setLoading] = useState(!getCache('workers'));
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'worker'
    });

    useEffect(() => {
        const q = query(collection(db, 'users'));
        const unsub = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setWorkers(items);
            setCache('workers', items, TTL.WORKERS); // cache for 5 minutes
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleAddWorker = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Note: In real production, this should be done via Cloud Functions
            // Firebase client SDK doesn't allow creating another user while logged in
            // as owner unless using a second auth instance or Cloud Function.
            // For now, we simulate the structure.
            toast.loading('Creating worker secure account...');
            
            // This will error if owner is logged in (security constraint of FB)
            // USER: Use Firebase Admin SDK or Cloud Function for this in prod!
            // I will implement the firestore logic here.
            
            const workerRef = doc(db, 'users', formData.email.replace(/[^a-zA-Z0-9]/g, '_'));
            await setDoc(workerRef, {
                name: formData.name,
                email: formData.email,
                role: formData.role,
                createdAt: serverTimestamp()
            });

            toast.dismiss();
            toast.success('Worker document created. (Auth must be added manually or via Admin SDK)');
            setIsAddModalOpen(false);
        } catch (error) {
            toast.dismiss();
            toast.error('Error: Check Cloud Function deployment');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteWorker = async (worker) => {
        if (worker.role === 'owner') {
            toast.error('Cannot delete the owner account');
            return;
        }
        if (window.confirm(`Are you sure you want to deactivate ${worker.name}?`)) {
            try {
                await deleteDoc(doc(db, 'users', worker.id));
                toast.success('Worker deactivated');
            } catch (error) {
                toast.error('Error deleting worker');
            }
        }
    };

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-white p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none"></div>
                <div className="z-10">
                    <h1 className="text-4xl font-black text-primary tracking-tighter">Authorized Workers</h1>
                    <p className="text-slate-500 font-bold mt-2 flex items-center gap-2">
                        <Users size={18} className="text-indigo-500" /> Manage access for your shop staff
                    </p>
                </div>
                <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="z-10 btn btn-accent h-14 px-8 font-black uppercase tracking-widest text-xs shadow-2xl shadow-orange-500/20 group hover:scale-[1.02] active:scale-95 transition-all"
                >
                    <UserPlus size={18} className="mr-2 group-hover:rotate-12 transition-transform" /> Add New Worker
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-20 text-center font-bold text-slate-300 animate-pulse">Syncing worker registry...</div>
                ) : workers.map(worker => (
                    <div key={worker.id} className="card p-8 group hover:ring-2 ring-indigo-500/20 transition-all duration-300 relative overflow-hidden">
                        {worker.role === 'owner' && (
                             <div className="absolute top-0 right-0 px-4 py-1 bg-primary text-[10px] font-black uppercase text-white tracking-widest rounded-bl-xl shadow-lg">ROOT ADMIN</div>
                        )}
                        <div className="flex items-center gap-4 mb-8">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-xl ${worker.role === 'owner' ? 'bg-primary' : 'bg-indigo-500'}`}>
                                {worker.role === 'owner' ? <ShieldCheck size={32} /> : <UserIcon size={32} />}
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-primary tracking-tight">{worker.name}</h3>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-1">{worker.role}</p>
                            </div>
                        </div>

                        <div className="space-y-4 pt-6 border-t border-slate-50">
                            <div className="flex items-center gap-3 text-slate-500 font-bold text-sm">
                                <Mail size={16} className="text-slate-300" /> {worker.email}
                            </div>
                            <div className="flex items-center gap-3 text-emerald-500 font-black text-[10px] uppercase tracking-widest">
                                <Zap size={16} /> Active Status Enabled
                            </div>
                        </div>

                        {worker.role !== 'owner' && (
                            <div className="mt-8 pt-6 border-t border-slate-50 flex gap-2 overflow-hidden">
                                <button 
                                    onClick={() => handleDeleteWorker(worker)}
                                    className="flex-1 btn btn-outline h-12 bg-red-50 text-red-500 border-none font-black uppercase tracking-widest text-[10px] hover:bg-red-500 hover:text-white transition-all"
                                >
                                    <Trash2 size={16} className="mr-2" /> Deactivate
                                </button>
                                <button className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-indigo-600 hover:bg-indigo-50 transition-all">
                                    <UserCheck size={20} />
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Add Worker Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-primary/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 border-8 border-slate-50">
                        <div className="p-10">
                            <div className="flex justify-between items-center mb-10">
                                <div>
                                    <h2 className="text-3xl font-black text-primary tracking-tight">Staff Enrollment</h2>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Create secure access for new worker</p>
                                </div>
                                <button onClick={() => setIsAddModalOpen(false)} className="p-4 bg-slate-50 text-slate-400 hover:text-red-500 rounded-full transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleAddWorker} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block pl-1">Full Identity Name</label>
                                    <div className="flex items-center bg-slate-50 rounded-2xl p-2 border border-slate-100 transition-all focus-within:ring-4 ring-indigo-100">
                                        <div className="bg-white p-3 rounded-xl shadow-sm"><UserIcon size={20} className="text-indigo-500" /></div>
                                        <input required className="bg-transparent border-none outline-none flex-1 px-4 font-bold text-slate-700" placeholder="e.g. Rahul Sharma" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block pl-1">Sync Email Address</label>
                                    <div className="flex items-center bg-slate-50 rounded-2xl p-2 border border-slate-100 transition-all focus-within:ring-4 ring-indigo-100">
                                        <div className="bg-white p-3 rounded-xl shadow-sm"><Mail size={20} className="text-indigo-500" /></div>
                                        <input required type="email" className="bg-transparent border-none outline-none flex-1 px-4 font-bold text-slate-700" placeholder="rahul@pventerprises.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                    </div>
                                </div>

                                <div className="space-y-2 pb-6">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block pl-1">Access Credentials</label>
                                    <div className="flex items-center bg-slate-50 rounded-2xl p-2 border border-slate-100 transition-all focus-within:ring-4 ring-indigo-100">
                                        <div className="bg-white p-3 rounded-xl shadow-sm"><Lock size={20} className="text-indigo-500" /></div>
                                        <input required type="password" underline className="bg-transparent border-none outline-none flex-1 px-4 font-bold text-slate-700" placeholder="Secure Password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4">
                                     <button type="submit" className="btn btn-primary h-16 w-full font-black uppercase tracking-widest text-xs shadow-2xl shadow-indigo-200">Finalize Worker Creation</button>
                                     <p className="text-[9px] text-center font-bold text-slate-300 uppercase leading-relaxed">By creating this account, you grant the user permission to access stock records and generate bills under your shop identity.</p>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Workers;
