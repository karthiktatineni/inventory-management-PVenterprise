import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            const emailLower = email.toLowerCase();
            
            let role = '';
            // 1. Try Firestore
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) role = userDoc.data().role;
            } catch (pErr) {
                console.warn("Firestore lookup blocked by rules, falling back to email check.");
            }

            // 2. Email Fallback
            if (!role) {
                if (emailLower === 'owner@gmail.com') role = 'owner';
                else if (emailLower === 'worker@gmail.com') role = 'worker';
            }

            if (role === 'owner') {
                toast.success('Owner Session Authorized');
                navigate('/dashboard');
            } else if (role === 'worker') {
                toast.success('Worker Session Authorized');
                navigate('/billing');
            } else {
                toast.error('Account unauthorized: No role assigned.');
            }
        } catch (error) {
            console.error(error);
            toast.error(error.message || 'Login failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-slate-200">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-primary">PV Enterprises</h1>
                    <p className="text-slate-500">Inventory Management System</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                        <input
                            type="email"
                            required
                            className="input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="owner@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <input
                            type="password"
                            required
                            className="input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                    </div>
                    <button
                        disabled={loading}
                        type="submit"
                        className="w-full btn btn-primary py-3"
                    >
                        {loading ? 'Logging in...' : 'Sign In'}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-center gap-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        OWNER
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        WORKER
                    </span>
                </div>
            </div>
        </div>
    );
};

export default Login;
