import { useState, useEffect, useMemo } from 'react'; 
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, query, orderBy, onSnapshot, 
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc 
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
// Removed 'Plus' to fix the GitHub build error
import { Trash2, Calendar, ReceiptText, Lock, PieChart, X } from 'lucide-react';

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
}

const CATEGORIES = [
  'Walmart', 'Chick-fil-A', 'McDonald\'s', "Salsarita's", 
  'Food City', 'Target', 'Publix', 'Panda Express', 
  'Freddy\'s', 'Starbucks', 'Taco Bell', 'Dunkin', 'Gas', 'Misc'
];

const PIN = "3270";

export default function App() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    const unsubBudget = onSnapshot(doc(db, 'budgets', 'main_config'), (snap) => {
      if (snap.exists()) setMonthlyBudget(snap.data().monthlyBudget);
    });
    const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    const unsubExpenses = onSnapshot(q, (snapshot) => {
      setExpenses(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Expense)));
      setLoading(false);
    });
    return () => { unsubBudget(); unsubExpenses(); };
  }, []);

  useEffect(() => {
    if (pinInput === PIN) {
      setIsUnlocked(true);
    } else if (pinInput.length >= 4) {
      setPinInput("");
    }
  }, [pinInput]);

  const totalSpent = useMemo(() => expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0), [expenses]);
  const remaining = monthlyBudget - totalSpent;

  const chartData = useMemo(() => {
    const totals: Record<string, number> = {};
    expenses.forEach(e => {
      totals[e.category] = (totals[e.category] || 0) + (Number(e.amount) || 0);
    });
    return Object.entries(totals)
      .filter(([_, value]) => value > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  if (!isUnlocked) {
    return (
      <div className="h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
        <Lock className="mb-6 text-blue-400" size={48} />
        {/* Changed to text-white for visibility */}
        <h1 className="text-xl font-black mb-8 tracking-widest text-white">ENTER PIN</h1>
        <div className="flex gap-4 mb-12">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 border-blue-400 ${pinInput.length > i ? 'bg-blue-400' : 'bg-transparent'}`} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
            <button key={n} onClick={() => setPinInput(prev => prev + n)} className="w-16 h-16 rounded-full bg-slate-800 text-2xl font-bold active:bg-blue-600 transition-colors">{n}</button>
          ))}
          <div />
          <button onClick={() => setPinInput(prev => prev + "0")} className="w-16 h-16 rounded-full bg-slate-800 text-2xl font-bold active:bg-blue-600 transition-colors">0</button>
          <button onClick={() => setPinInput("")} className="w-16 h-16 flex items-center justify-center text-slate-500"><X /></button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="h-screen flex items-center justify-center font-bold text-slate-400 uppercase tracking-widest">Syncing...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      <div className="sticky top-0 z-30 bg-slate-50/90 backdrop-blur-md px-4 pt-6 pb-2">
        <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-xl p-6 border border-white">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monthly Budget</p>
              <input type="number" className="text-2xl font-black focus:outline-none w-32" value={monthlyBudget || ''} onChange={(e) => setDoc(doc(db, 'budgets', 'main_config'), { monthlyBudget: Number(e.target.value) }, { merge: true })} />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Remaining</p>
              <p className={`text-2xl font-black ${remaining < 0 ? 'text-red-500' : 'text-emerald-500'}`}>${remaining.toFixed(2)}</p>
            </div>
          </div>
          
          <div className="mt-4">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
               <PieChart size={10} /> Distribution
             </p>
             <div className="flex h-4 w-full rounded-full overflow-hidden bg-slate-100">
               {chartData.map(([cat, val], i) => (
                 <div 
                   key={cat} 
                   style={{ width: `${(val / totalSpent) * 100}%` }} 
                   className={`${['bg-blue-500', 'bg-emerald-500', 'bg-orange-500', 'bg-purple-500', 'bg-pink-500', 'bg-yellow-500'][i % 6]}`}
                 />
               ))}
             </div>
          </div>
        </div>
      </div>

      <main className="max-w-xl mx-auto px-4 mt-8">
        <div className="grid grid-cols-3 gap-2 mb-8">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => addDoc(collection(db, 'expenses'), { category: cat, amount: 0, date: new Date().toISOString().split('T')[0], createdAt: serverTimestamp() })} className="py-3 px-1 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-700 shadow-sm active:bg-blue-600 active:text-white transition-all uppercase truncate">
              + {cat}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><ReceiptText size={12}/> History</h2>
          {expenses.map(exp => (
            <div key={exp.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex justify-between mb-1">
                  <input className="font-black text-slate-800 bg-transparent focus:outline-none w-full" value={exp.category} onChange={(e) => updateDoc(doc(db, 'expenses', exp.id), { category: e.target.value })} />
                  <div className="flex items-center text-blue-600 font-black">
                    <span className="text-sm mr-0.5">$</span>
                    <input type="number" className="w-16 text-right bg-transparent focus:outline-none" value={exp.amount || ''} onChange={(e) => updateDoc(doc(db, 'expenses', exp.id), { amount: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="flex justify-between text-slate-400">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    <input type="date" className="text-[10px] bg-transparent focus:outline-none font-bold uppercase" value={exp.date} onChange={(e) => updateDoc(doc(db, 'expenses', exp.id), { date: e.target.value })} />
                  </div>
                  <button onClick={() => deleteDoc(doc(db, 'expenses', exp.id))} className="text-slate-200 hover:text-red-400"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}