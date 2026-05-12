import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, query, orderBy, onSnapshot, 
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc 
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { Trash2, Plus, Calendar, CreditCard } from 'lucide-react';

// --- YOUR FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyDubrSy5eJ__fMycwDqGILFHRH1p8jMv-Y",
  authDomain: "budget-6a317.firebaseapp.com",
  projectId: "budget-6a317",
  storageBucket: "budget-6a317.firebasestorage.app",
  messagingSenderId: "595257461791",
  appId: "1:595257461791:web:1875fac56cd32306a4d92a",
  measurementId: "G-69JTN9RHY7"
};

// Initialize Firebase Services
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- TYPES ---
interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
  notes?: string;
  createdAt: any;
}

// --- UTILS ---
const formatCurrency = (num: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);

const CATEGORIES = [
  'Walmart', 'Chick-fil-A', 'McDonald\'s', 'Sarsitars', 
  'Food City', 'Target', 'Publix', 'Panda Express', 
  'Freddy\'s', 'Gas', 'Misc'
];

export default function App() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // --- DATA SYNC ---
  useEffect(() => {
    // 1. Sign in Anonymously immediately
    signInAnonymously(auth).catch(err => console.error("Auth failed:", err));

    // 2. Sync Budget Value
    const budgetRef = doc(db, 'budgets', 'main_config');
    const unsubBudget = onSnapshot(budgetRef, (docSnap) => {
      if (docSnap.exists()) {
        setMonthlyBudget(docSnap.data().monthlyBudget);
      }
    });

    // 3. Sync Expenses List
    const q = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'));
    const unsubExpenses = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
      setExpenses(data);
      setLoading(false);
    });

    return () => { unsubBudget(); unsubExpenses(); };
  }, []);

  // --- DB ACTIONS ---
  const handleBudgetUpdate = async (val: number) => {
    setMonthlyBudget(val);
    await setDoc(doc(db, 'budgets', 'main_config'), { 
      monthlyBudget: val, 
      updatedAt: serverTimestamp() 
    }, { merge: true });
  };

  const addExpense = async (category: string) => {
    await addDoc(collection(db, 'expenses'), {
      category,
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      notes: '',
      createdAt: serverTimestamp()
    });
  };

  const updateExpense = async (id: string, updates: Partial<Expense>) => {
    await updateDoc(doc(db, 'expenses', id), updates);
  };

  const deleteExpense = async (id: string) => {
    if (window.confirm('Delete this expense?')) {
      await deleteDoc(doc(db, 'expenses', id));
    }
  };

  // --- COMPUTATIONS ---
  const totalSpent = useMemo(() => 
    expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0), 
  [expenses]);

  const remaining = monthlyBudget - totalSpent;

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50 space-y-4">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium animate-pulse">Connecting to Firebase...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 pb-10">
      {/* HEADER / SUMMARY BOX */}
      <header className="sticky top-0 z-30 bg-gray-50/90 backdrop-blur-md px-4 pt-6 pb-2">
        <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl shadow-blue-900/5 border border-white p-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-black mb-1 block">
                Starting Budget
              </label>
              <div className="flex items-center text-2xl font-bold text-slate-800">
                <span className="text-blue-500 mr-1">$</span>
                <input 
                  type="number" 
                  className="w-full bg-transparent focus:outline-none focus:ring-2 ring-blue-50 rounded"
                  value={monthlyBudget || ''}
                  onChange={(e) => handleBudgetUpdate(Number(e.target.value))}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="text-right">
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-black mb-1 block">
                Left to Spend
              </label>
              <p className={`text-2xl font-black ${remaining < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {formatCurrency(remaining)}
              </p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
            <div 
              className={`h-full transition-all duration-700 ease-out ${remaining < 0 ? 'bg-red-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(100, (totalSpent / monthlyBudget) * 100 || 0)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
             <span className="text-[10px] font-bold text-slate-400">0%</span>
             <span className="text-[10px] font-bold text-slate-400">Total Spent: {formatCurrency(totalSpent)}</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-6">
        {/* QUICK ACTIONS */}
        <section className="mb-8">
          <h2 className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">
            <Plus size={14} /> Quick Add
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => addExpense(cat)}
                className="py-3 px-2 bg-white border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 shadow-sm active:scale-95 active:bg-blue-600 active:text-white active:border-blue-600 transition-all text-center truncate"
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        {/* EXPENSES LOG */}
        <section>
          <h2 className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">
            <CreditCard size={14} /> Spending Log
          </h2>
          
          <div className="space-y-3">
            {expenses.length === 0 && (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl py-12 text-center">
                <p className="text-slate-400 italic font-medium text-sm">No expenses yet. Tap a button above!</p>
              </div>
            )}
            
            {expenses.map(exp => (
              <div 
                key={exp.id} 
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 group animate-in fade-in slide-in-from-bottom-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <input 
                      className="font-bold text-slate-800 w-full bg-transparent focus:ring-0 focus:outline-none truncate"
                      value={exp.category}
                      onChange={(e) => updateExpense(exp.id, { category: e.target.value })}
                    />
                    <div className="flex items-center text-blue-600 font-black ml-2">
                      <span className="text-xs mr-0.5">$</span>
                      <input 
                        type="number"
                        className="w-20 text-right bg-transparent focus:outline-none focus:ring-2 ring-blue-50 rounded"
                        value={exp.amount || ''}
                        placeholder="0"
                        onChange={(e) => updateExpense(exp.id, { amount: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Calendar size={12} className="shrink-0" />
                      <input 
                        type="date"
                        className="text-[11px] bg-transparent focus:outline-none font-medium"
                        value={exp.date}
                        onChange={(e) => updateExpense(exp.id, { date: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <input 
                        className="text-[11px] text-slate-400 italic w-32 text-right bg-transparent focus:outline-none hidden sm:block"
                        placeholder="Add note..."
                        value={exp.notes || ''}
                        onChange={(e) => updateExpense(exp.id, { notes: e.target.value })}
                      />
                      <button 
                        onClick={() => deleteExpense(exp.id)}
                        className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}