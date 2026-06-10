import { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore, collection, onSnapshot, query,
  addDoc, updateDoc, deleteDoc, doc, writeBatch,
  Timestamp
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { Trash2, Plus, ArrowUp, ArrowDown } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FixedItem {
  id: string;
  name: string;
  amount: number;
  order?: number;
  createdAt: Timestamp | null;
}

// ─── Firebase Config ──────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: "AIzaSyDubrSy5eJ__fMycwDqGILFHRH1p8jMv-Y",
  authDomain: "budget-6a317.firebaseapp.com",
  projectId: "budget-6a317",
  storageBucket: "budget-6a317.firebasestorage.app",
  messagingSenderId: "595257461791",
  appId: "1:595257461791:web:1875fac56cd32306a4d92a",
  measurementId: "G-69JTN9RHY7"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function handleAmountMaskChange(rawInputValue: string): number {
  const digitsOnly = rawInputValue.replace(/\D/g, "");
  if (!digitsOnly) return 0;
  return parseInt(digitsOnly, 10) / 100;
}

function fmtDollar(num: number): string {
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function FixedExpenses() {
  const [incomes, setIncomes] = useState<FixedItem[]>([]);
  const [expenses, setExpenses] = useState<FixedItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [incName, setIncName] = useState("");
  const [incAmount, setIncAmount] = useState("");
  const [expName, setExpName] = useState("");
  const [expAmount, setExpAmount] = useState("");

  // Staging states for delete confirmations
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
  }, []);

  // ── Firestore Subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    const qIncome = query(collection(db, 'income'));
    const unsubIncome = onSnapshot(qIncome, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as FixedItem[];
      const sorted = data.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
        if (a.order !== undefined) return -1;
        if (b.order !== undefined) return 1;
        return (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0);
      });
      setIncomes(sorted);
    });

    const qExpense = query(collection(db, 'fixed_expenses'));
    const unsubExpense = onSnapshot(qExpense, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as FixedItem[];
      const sorted = data.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
        if (a.order !== undefined) return -1;
        if (b.order !== undefined) return 1;
        return (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0);
      });
      setExpenses(sorted);
      setLoading(false);
    });

    return () => {
      unsubIncome();
      unsubExpense();
    };
  }, []);

  // Reset staging states on click away
  useEffect(() => {
    if (!deletingId) return;
    const handleGlobalClick = () => setDeletingId(null);
    window.addEventListener('pointerdown', handleGlobalClick);
    return () => window.removeEventListener('pointerdown', handleGlobalClick);
  }, [deletingId]);

  // ── Reordering Core Engine ──────────────────────────────────────────────────
  const handleMoveItem = async (list: FixedItem[], index: number, direction: 'up' | 'down', collectionName: string) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const batch = writeBatch(db);

    list.forEach((item, idx) => {
      let finalOrder = idx;
      if (idx === index) finalOrder = targetIndex;
      else if (idx === targetIndex) finalOrder = index;

      batch.set(doc(db, collectionName, item.id), { order: finalOrder }, { merge: true });
    });

    await batch.commit();
  };

  // ── Mutation Handlers ───────────────────────────────────────────────────────
  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incName.trim()) return;
    const amount = handleAmountMaskChange(incAmount);
    
    await addDoc(collection(db, 'income'), {
      name: incName.trim(),
      amount,
      order: incomes.length,
      createdAt: Timestamp.now()
    });

    setIncName("");
    setIncAmount("");
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expName.trim()) return;
    const amount = handleAmountMaskChange(expAmount);

    await addDoc(collection(db, 'fixed_expenses'), {
      name: expName.trim(),
      amount,
      order: expenses.length,
      createdAt: Timestamp.now()
    });

    setExpName("");
    setExpAmount("");
  };

  // ── Computations ────────────────────────────────────────────────────────────
  const totalIncome = useMemo(() => incomes.reduce((sum, i) => sum + (i.amount || 0), 0), [incomes]);
  const totalExpenses = useMemo(() => expenses.reduce((sum, e) => sum + (e.amount || 0), 0), [expenses]);
  const net = totalIncome - totalExpenses;
  const netPositive = net >= 0;

  if (loading) return (
    <div className="h-screen bg-zinc-950 flex items-center justify-center font-black text-zinc-700 uppercase tracking-widest">
      Syncing Fixed Records...
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-32 pt-6 px-4 space-y-8 max-w-xl mx-auto">
      
      {/* ── Income Section ── */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Monthly Income Streams</h2>
        
        <form onSubmit={handleAddIncome} className="flex gap-2 bg-zinc-900 border border-zinc-800/80 p-2 rounded-2xl">
          <input
            type="text"
            placeholder="Source Name"
            className="flex-1 bg-transparent px-3 py-1.5 focus:outline-none text-sm font-bold placeholder:text-zinc-600"
            value={incName}
            onChange={(e) => setIncName(e.target.value)}
          />
          <input
            type="text"
            inputMode="numeric"
            placeholder="$0.00"
            className="w-24 bg-transparent text-right px-2 py-1.5 focus:outline-none text-sm font-bold text-emerald-400 placeholder:text-zinc-600"
            value={incAmount ? `$${handleAmountMaskChange(incAmount).toFixed(2)}` : ""}
            onChange={(e) => setIncAmount(e.target.value)}
          />
          <button type="submit" className="p-2 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-300 active:bg-blue-600 active:text-white transition-all touch-manipulation">
            <Plus size={16} className="stroke-[2.5]" />
          </button>
        </form>

        <div className="space-y-2">
          {incomes.map((item, idx) => {
            const isStagingDelete = deletingId === item.id;
            return (
              <div key={item.id} className="p-4 bg-zinc-900 border border-zinc-800/60 rounded-2xl flex items-center justify-between group">
                <div className="min-w-0 flex-1 pr-2">
                  <input
                    className="font-black text-zinc-200 bg-transparent focus:outline-none w-full text-sm"
                    value={item.name}
                    onChange={(e) => updateDoc(doc(db, 'income', item.id), { name: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center text-emerald-400 font-black text-sm">
                    <span>$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="w-20 text-right bg-transparent focus:outline-none text-zinc-200"
                      value={(item.amount || 0).toFixed(2)}
                      onChange={(e) => {
                        const val = handleAmountMaskChange(e.target.value);
                        updateDoc(doc(db, 'income', item.id), { amount: val });
                      }}
                    />
                  </div>

                  {/* Reordering Controls */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveItem(incomes, idx, 'up', 'income')}
                      className="text-zinc-600 hover:text-zinc-400 active:text-blue-400 disabled:opacity-20 touch-manipulation"
                    >
                      <ArrowUp size={12} className="stroke-[3]" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === incomes.length - 1}
                      onClick={() => handleMoveItem(incomes, idx, 'down', 'income')}
                      className="text-zinc-600 hover:text-zinc-400 active:text-blue-400 disabled:opacity-20 touch-manipulation"
                    >
                      <ArrowDown size={12} className="stroke-[3]" />
                    </button>
                  </div>

                  <div className="relative flex items-center min-w-[24px] justify-end">
                    {isStagingDelete ? (
                      <button
                        type="button"
                        onPointerDown={(e) => { e.stopPropagation(); }}
                        onPointerUp={() => deleteDoc(doc(db, 'income', item.id))}
                        className="bg-red-500 text-white text-[9px] font-black tracking-wider uppercase px-2 py-1 rounded-lg animate-fadeIn touch-manipulation"
                      >
                        Delete?
                      </button>
                    ) : (
                      <button
                        type="button"
                        onPointerDown={(e) => { e.stopPropagation(); setDeletingId(item.id); }}
                        className="text-zinc-700 active:text-red-400 p-1 transition-colors touch-manipulation"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Fixed Expenses Section ── */}
      <section className="space-y-3">
        <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Fixed Commitments</h2>

        <form onSubmit={handleAddExpense} className="flex gap-2 bg-zinc-900 border border-zinc-800/80 p-2 rounded-2xl">
          <input
            type="text"
            placeholder="Expense / Bill Target"
            className="flex-1 bg-transparent px-3 py-1.5 focus:outline-none text-sm font-bold placeholder:text-zinc-600"
            value={expName}
            onChange={(e) => setExpName(e.target.value)}
          />
          <input
            type="text"
            inputMode="numeric"
            placeholder="$0.00"
            className="w-24 bg-transparent text-right px-2 py-1.5 focus:outline-none text-sm font-bold text-red-400 placeholder:text-zinc-600"
            value={expAmount ? `$${handleAmountMaskChange(expAmount).toFixed(2)}` : ""}
            onChange={(e) => setExpAmount(e.target.value)}
          />
          <button type="submit" className="p-2 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-300 active:bg-blue-600 active:text-white transition-all touch-manipulation">
            <Plus size={16} className="stroke-[2.5]" />
          </button>
        </form>

        <div className="space-y-2">
          {expenses.map((item, idx) => {
            const isStagingDelete = deletingId === item.id;
            return (
              <div key={item.id} className="p-4 bg-zinc-900 border border-zinc-800/60 rounded-2xl flex items-center justify-between group">
                <div className="min-w-0 flex-1 pr-2">
                  <input
                    className="font-black text-zinc-200 bg-transparent focus:outline-none w-full text-sm"
                    value={item.name}
                    onChange={(e) => updateDoc(doc(db, 'fixed_expenses', item.id), { name: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center text-red-400 font-black text-sm">
                    <span>$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="w-20 text-right bg-transparent focus:outline-none text-zinc-200"
                      value={(item.amount || 0).toFixed(2)}
                      onChange={(e) => {
                        const val = handleAmountMaskChange(e.target.value);
                        updateDoc(doc(db, 'fixed_expenses', item.id), { amount: val });
                      }}
                    />
                  </div>

                  {/* Reordering Controls */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveItem(expenses, idx, 'up', 'fixed_expenses')}
                      className="text-zinc-600 hover:text-zinc-400 active:text-blue-400 disabled:opacity-20 touch-manipulation"
                    >
                      <ArrowUp size={12} className="stroke-[3]" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === expenses.length - 1}
                      onClick={() => handleMoveItem(expenses, idx, 'down', 'fixed_expenses')}
                      className="text-zinc-600 hover:text-zinc-400 active:text-blue-400 disabled:opacity-20 touch-manipulation"
                    >
                      <ArrowDown size={12} className="stroke-[3]" />
                    </button>
                  </div>

                  <div className="relative flex items-center min-w-[24px] justify-end">
                    {isStagingDelete ? (
                      <button
                        type="button"
                        onPointerDown={(e) => { e.stopPropagation(); }}
                        onPointerUp={() => deleteDoc(doc(db, 'fixed_expenses', item.id))}
                        className="bg-red-500 text-white text-[9px] font-black tracking-wider uppercase px-2 py-1 rounded-lg animate-fadeIn touch-manipulation"
                      >
                        Delete?
                      </button>
                    ) : (
                      <button
                        type="button"
                        onPointerDown={(e) => { e.stopPropagation(); setDeletingId(item.id); }}
                        className="text-zinc-700 active:text-red-400 p-1 transition-colors touch-manipulation"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Summary Card ── */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-3 shadow-xl">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Summary Breakdown</p>

        <div className="flex justify-between items-center">
          <span className="text-sm text-zinc-400">Total Fixed Income</span>
          <span className="font-black text-emerald-400">${fmtDollar(totalIncome)}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-zinc-400">Total Fixed Commitments</span>
          <span className="font-black text-red-400">${fmtDollar(totalExpenses)}</span>
        </div>

        <div className="border-t border-zinc-800 pt-3 flex justify-between items-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            {netPositive ? 'Unallocated Discretionary' : 'Fixed Shortfall'}
          </span>
          <span className={`text-2xl font-black ${netPositive ? 'text-zinc-100' : 'text-red-400'}`}>
            {netPositive ? '' : '-'}${fmtDollar(Math.abs(net))}
          </span>
        </div>
      </section>
    </div>
  );
}