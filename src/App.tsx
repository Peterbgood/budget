import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, query, orderBy, onSnapshot, 
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc 
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { Trash2, Plus, Calendar, ReceiptText, Wallet } from 'lucide-react';

// --- FIREBASE CONFIG (Using your provided keys) ---
const firebaseConfig = {
  apiKey: "AIzaSyDubrSy5eJ__fMycwDqGILFHRH1p8jMv-Y",
  authDomain: "budget-6a317.firebaseapp.com",
  projectId: "budget-6a317",
  storageBucket: "budget-6a317.firebasestorage.app",
  messagingSenderId: "595257461791",
  appId: "1:595257461791:web:1875fac56cd32306a4d92a",
  measurementId: "G-69JTN9RHY7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
  notes?: string;
  createdAt: any;
}

const formatCurrency = (num: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);

const CATEGORIES = [
  'Walmart', 'Chick-fil-A', 'McDonald\'s', "Salsarita's", 
  'Food City', 'Target', 'Publix', 'Panda Express', 
  'Freddy\'s', 'Gas', 'Misc'
];

export default function App() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Authenticate
    signInAnonymously(auth).catch((err) => console.error("Auth Error:", err));

    // 2. Sync Budget
    const unsubBudget = onSnapshot(doc(db, 'budgets', 'main_config'), (snap) => {
      if (snap.exists()) setMonthlyBudget(snap.data().monthlyBudget);
    });

    // 3. Sync Expenses (Simplified sorting to avoid Index errors)
    const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    const unsubExpenses = onSnapshot(q, (snapshot) => {
      setExpenses(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Expense)));
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
      setLoading(false);
    });

    return () => { unsubBudget(); unsubExpenses(); };
  }, []);

  const handleBudgetUpdate = async (val: number) => {
    setMonthlyBudget(val);
    await setDoc(doc(db, 'budgets', 'main_config'), { monthlyBudget: val }, { merge: true });
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
    await deleteDoc(doc(db, 'expenses', id));
  };

  const totalSpent = useMemo(() => 
    expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0), 
  [expenses]);

  const remaining = monthlyBudget - totalSpent;

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-slate-500 font-bold tracking-widest text-xs">LOADING SPENDY...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12 font-sans">
      {/* STICKY SUMMARY CARD */}
      <div className="sticky top-0 z-30 bg-slate-50/90 backdrop-blur-md px-4 pt-6 pb-2">
        <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-xl shadow-blue-900/5 border border-white p-6">
          <div className="flex justify-between items-center mb-5">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Budget Goal</p>
              <div className="flex items-center text-3xl font-black text-slate-800">
                <span className="text-blue-500 mr-1 text-xl">$</span>
                <input 
                  type="number" 
                  className="w-32 bg-transparent focus:outline-none"
                  value={monthlyBudget || ''}
                  onChange={(e) => handleBudgetUpdate(Number(e.target.value))}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Left to Spend</p>
              <p className={`text-3xl font-black ${remaining < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {formatCurrency(remaining)}
              </p>
            </div>
          </div>
          
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ease-out ${remaining < 0 ? 'bg-red-500' : 'bg-blue-600'}`}
              style={{ width: `${Math.min(100, (totalSpent / monthlyBudget) * 100 || 0)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] font-bold text-slate-400">0%</span>
            <span className="text-[10px] font-bold text-slate-500">Spent: {formatCurrency(totalSpent)}</span>
          </div>
        </div>
      </div>

      <main className="max-w-xl mx-auto px-4 mt-8">
        {/* QUICK ADD ACTIONS */}
        <section className="mb-10">
          <h2 className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-1">
            <Plus size={14} className="text-blue-500" /> Tap to Add
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => addExpense(cat)}
                className="py-3 px-1 bg-white border border-slate-200 rounded-2xl text-[11px] font-black text-slate-700 shadow-sm active:scale-95 active:bg-blue-600 active:text-white transition-all truncate uppercase tracking-tighter"
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        {/* TRANSACTION LOG */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-1">
            <ReceiptText size={14} className="text-blue-500" /> History
          </h2>
          
          {expenses.map(exp => (
            <div key={exp.id} className="bg-white px-5 py-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <input 
                    className="font-black text-slate-800 bg-transparent focus:outline-none w-full text-base"
                    value={exp.category}
                    onChange={(e) => updateExpense(exp.id, { category: e.target.value })}
                  />
                  <div className="flex items-center text-blue-600 font-black text-lg">
                    <span className="text-sm mr-0.5">$</span>
                    <input 
                      type="number"
                      className="w-20 text-right bg-transparent focus:outline-none focus:ring-2 ring-blue-50 rounded px-1"
                      value={exp.amount || ''}
                      onChange={(e) => updateExpense(exp.id, { amount: Number(e.target.value) })}
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                    <Calendar size={12} className="text-blue-400" />
                    <input 
                      type="date"
                      className="text-[10px] bg-transparent focus:outline-none font-black uppercase tracking-tighter"
                      value={exp.date}
                      onChange={(e) => updateExpense(exp.id, { date: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      className="text-[11px] font-medium text-slate-400 italic bg-transparent focus:outline-none text-right w-24 sm:w-48 border-b border-transparent focus:border-slate-100"
                      placeholder="Write a note..."
                      value={exp.notes || ''}
                      onChange={(e) => updateExpense(exp.id, { notes: e.target.value })}
                    />
                    <button 
                      onClick={() => deleteExpense(exp.id)}
                      className="text-slate-200 hover:text-red-400 transition-colors p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {expenses.length === 0 && (
            <div className="text-center py-16 bg-white/50 border-2 border-dashed border-slate-200 rounded-3xl">
              <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wallet className="text-slate-400" size={20} />
              </div>
              <p className="text-slate-400 text-xs font-bold tracking-widest uppercase">Clean Slate</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}