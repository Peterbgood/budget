import { useState, useEffect, useMemo, useRef } from 'react'; 
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, query, orderBy, onSnapshot, 
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc, writeBatch 
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { Trash2, Calendar, ReceiptText, Lock, PieChart as PieIcon, X, Eraser, Download } from 'lucide-react';

interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
  createdAt: any;
}

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

const CATEGORIES = [
  'Walmart', 'Chick-fil-A', 'McDonald\'s', "Salsarita's", 
  'Food City', 'Target', 'Publix', 'Panda Express', 
  'Freddy\'s', 'Starbucks', 'Taco Bell', 'Dunkin', 'Amazon', 'Gas', 'Misc'
];

const APP_PIN = "3270";

export default function App() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<{ name: string; amount: number } | null>(null);
  
  // Track selected lines for the calculation pop-up
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  
  // Track the ID of a newly added item to auto-focus its amount field
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const amountInputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
  }, []);

  useEffect(() => {
    if (pinInput.length === 4) {
      if (pinInput === APP_PIN) {
        setIsAuthenticated(true);
      } else {
        const timer = setTimeout(() => setPinInput(''), 400);
        return () => clearTimeout(timer);
      }
    }
  }, [pinInput]);

  useEffect(() => {
    if (isAuthenticated) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') { 
        if (pinInput.length < 4) setPinInput(prev => prev + e.key); 
      }
      else if (e.key === 'Backspace') { 
        setPinInput(prev => prev.slice(0, -1)); 
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pinInput, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubBudget = onSnapshot(doc(db, 'budgets', 'main_config'), (snap) => {
      if (snap.exists()) {
        setMonthlyBudget(snap.data().monthlyBudget || 0);
      }
    });

    const q = query(
      collection(db, 'expenses'), 
      orderBy('date', 'desc'), 
      orderBy('createdAt', 'desc')
    );

    const unsubExpenses = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data() 
      })) as Expense[];

      const sortedData = data.sort((a, b) => {
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : null;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : null;
        
        if (timeA !== null && timeB !== null) {
          return timeB - timeA;
        }
        return b.id.localeCompare(a.id);
      });

      setExpenses(sortedData);
      setLoading(false);
    }, (error) => {
        console.error("Firebase Query Error:", error);
        setLoading(false);
    });

    return () => {
      unsubBudget();
      unsubExpenses();
    };
  }, [isAuthenticated]);

  // Hook to handle auto-anchoring focus onto a newly appended transaction row
  useEffect(() => {
    if (justAddedId && amountInputsRef.current[justAddedId]) {
      const targetInput = amountInputsRef.current[justAddedId];
      if (targetInput) {
        targetInput.focus();
        // Soft timeout helps iOS Safari adjust scroll layout context cleanly
        setTimeout(() => {
          targetInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 80);
      }
      setJustAddedId(null);
    }
  }, [expenses, justAddedId]);

  const handleAddNewExpense = async (categoryName: string) => {
    const docRef = await addDoc(collection(db, 'expenses'), { 
      category: categoryName, 
      amount: 0, 
      date: new Date().toISOString().split('T')[0], 
      createdAt: serverTimestamp() 
    });
    setJustAddedId(docRef.id);
  };

  const handleClearAll = async () => {
    if (!window.confirm("Delete all transactions?")) return;
    const batch = writeBatch(db);
    expenses.forEach(exp => batch.delete(doc(db, 'expenses', exp.id)));
    await batch.commit();
    setSelectedExpenseIds([]);
  };

  const handleExportCSV = () => {
    if (expenses.length === 0) {
      window.alert("No transactions to export.");
      return;
    }
    
    const headers = ["Date", "Category", "Amount ($)"];
    const rows = expenses.map(exp => [
      exp.date,
      `"${exp.category.replace(/"/g, '""')}"`,
      exp.amount.toFixed(2)
    ]);
    
    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `expenses_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalSpent = useMemo(() => expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0), [expenses]);
  const remaining = monthlyBudget - totalSpent;

  const categoryTotalsMap = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + (Number(e.amount) || 0);
    });
    return map;
  }, [expenses]);

  const chartData = useMemo(() => {
    return Object.entries(categoryTotalsMap)
      .filter(([_, value]) => value > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [categoryTotalsMap]);

  const handleToggleSelectExpense = (id: string) => {
    setSelectedExpenseIds(prev => 
      prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
    );
  };

  const selectedLinesTotal = useMemo(() => {
    return expenses
      .filter(e => selectedExpenseIds.includes(e.id))
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [selectedExpenseIds, expenses]);

  if (!isAuthenticated) {
    return (
      <div className="h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-900">
        <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-white flex flex-col items-center">
          <Lock className="mb-6 text-blue-500" size={40} />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Enter Secure PIN</p>
          <div className="flex gap-4 mb-12">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${pinInput.length > i ? 'bg-blue-500 border-blue-500 scale-110' : 'bg-transparent border-slate-200'} ${pinInput.length === 4 && pinInput !== APP_PIN ? 'border-red-500 bg-red-500 animate-pulse' : ''}`} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4 select-none">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
              <button key={n} onClick={() => pinInput.length < 4 && setPinInput(prev => prev + n)} className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 text-xl font-black text-slate-700 active:bg-blue-500 active:text-white transition-all shadow-sm">{n}</button>
            ))}
            <div />
            <button onClick={() => pinInput.length < 4 && setPinInput(prev => prev + "0")} className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 text-xl font-black text-slate-700 active:bg-blue-500 active:text-white transition-all shadow-sm">0</button>
            <button onClick={() => setPinInput("")} className="w-16 h-16 flex items-center justify-center text-slate-300 hover:text-red-400"><X size={24}/></button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <div className="h-screen bg-slate-50 flex items-center justify-center font-black text-slate-300 uppercase tracking-widest">Syncing...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-32">
      <div className="px-4 pt-6 mb-6">
        <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-xl p-6 border border-white">
          
          <div className="text-center mb-6">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Remaining</p>
            <p className={`text-4xl font-black ${remaining < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
              ${remaining.toFixed(0)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 border-t border-slate-100 pt-4">
            <div className="text-center border-r border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Budget</p>
              <div className="flex items-center justify-center gap-1">
                <span className="text-xl font-black text-slate-300">$</span>
                <input 
                  type="number" 
                  className="text-2xl font-black focus:outline-none w-24 bg-transparent text-center" 
                  value={monthlyBudget || ''} 
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setMonthlyBudget(val);
                    setDoc(doc(db, 'budgets', 'main_config'), { monthlyBudget: val }, { merge: true });
                  }} 
                />
              </div>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Spent</p>
              <p className="text-2xl font-black text-slate-800">${totalSpent.toFixed(0)}</p>
            </div>
          </div>
          
          <div className="mt-4">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1">
               <PieIcon size={12} /> Visual Breakdown
             </p>
             <div className="flex h-8 w-full rounded-xl overflow-hidden bg-slate-100 shadow-inner mb-4">
               {chartData.map(([cat, val], i) => (
                 <div 
                   key={cat} 
                   style={{ width: `${(val / totalSpent) * 100}%` }} 
                   className={`${['bg-blue-500', 'bg-emerald-500', 'bg-orange-500', 'bg-purple-500', 'bg-pink-500', 'bg-yellow-500'][i % 6]} transition-all hover:opacity-80 group relative cursor-pointer`}
                   onClick={() => {
                     if (selectedCategory?.name === cat) {
                       setSelectedCategory(null);
                     } else {
                       setSelectedCategory({ name: cat, amount: Number(val) });
                     }
                   }}
                 >
                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-800 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-50 shadow-lg">
                      {cat}: ${Number(val).toFixed(0)}
                    </div>
                 </div>
               ))}
             </div>

             {selectedCategory && (
               <div className="mb-4 p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between animate-fadeIn">
                 <div className="text-[11px] font-black uppercase text-slate-600 tracking-wider flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                   Selected: <span className="text-slate-900">{selectedCategory.name}</span>
                 </div>
                 <div className="flex items-center gap-3">
                   <span className="text-sm font-black text-blue-600">${selectedCategory.amount.toFixed(0)}</span>
                   <button onClick={() => setSelectedCategory(null)} className="text-slate-400 hover:text-slate-600"><X size={14}/></button>
                 </div>
               </div>
             )}
             
             <div className="flex flex-wrap gap-x-4 gap-y-2">
                {chartData.map(([cat, val], i) => (
                  <div key={cat} className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase">
                    <div className={`w-2 h-2 rounded-full ${['bg-blue-500', 'bg-emerald-500', 'bg-orange-500', 'bg-purple-500', 'bg-pink-500', 'bg-yellow-500'][i % 6]}`} />
                    {cat} <span className="text-slate-300 ml-0.5">${Number(val).toFixed(0)}</span>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>

      <main className="max-w-xl mx-auto px-4 mt-8">
        <div className="grid grid-cols-3 gap-1.5 mb-8">
          {CATEGORIES.map(cat => {
            const catTotal = categoryTotalsMap[cat] || 0;
            return (
              <button 
                key={cat} 
                onClick={() => handleAddNewExpense(cat)} 
                className="py-2 px-2 bg-white border border-slate-100 rounded-xl text-[10px] font-black text-slate-700 shadow-sm active:bg-blue-600 active:text-white transition-all uppercase truncate flex items-center justify-center gap-1 touch-manipulation"
              >
                <span className="truncate">+ {cat}</span>
                {catTotal > 0 && <span className="text-slate-400 font-bold shrink-0">(${catTotal.toFixed(0)})</span>}
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><ReceiptText size={12}/> History</h2>
          {expenses.map(exp => {
            const isSelected = selectedExpenseIds.includes(exp.id);
            return (
              <div 
                key={exp.id} 
                onPointerDown={(e) => {
                  // Using pointer event checks ensures instantaneous response across iOS Safari
                  const targetTagName = (e.target as HTMLElement).tagName.toLowerCase();
                  if (targetTagName !== 'input' && targetTagName !== 'button' && !(e.target as HTMLElement).closest('button')) {
                    handleToggleSelectExpense(exp.id);
                  }
                }}
                className={`p-4 rounded-2xl border transition-all duration-150 flex items-center gap-4 shadow-sm select-none touch-manipulation ${
                  isSelected 
                    ? 'bg-blue-5/70 border-blue-200 ring-2 ring-blue-500/10' 
                    : 'bg-white border-slate-100 hover:border-slate-200'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-1">
                    <input className="font-black text-slate-800 bg-transparent focus:outline-none w-full" value={exp.category} onChange={(e) => updateDoc(doc(db, 'expenses', exp.id), { category: e.target.value })} />
                    <div className="flex items-center text-blue-600 font-black">
                      <span className="text-sm mr-0.5">$</span>
                      <input 
                        type="number" 
                        ref={el => { amountInputsRef.current[exp.id] = el; }}
                        className="w-16 text-right bg-transparent focus:outline-none" 
                        value={exp.amount || ''} 
                        onChange={(e) => updateDoc(doc(db, 'expenses', exp.id), { amount: Number(e.target.value) })} 
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <div className="flex items-center gap-1">
                      <Calendar size={12} />
                      <input type="date" className="text-[10px] bg-transparent focus:outline-none font-bold uppercase" value={exp.date} onChange={(e) => updateDoc(doc(db, 'expenses', exp.id), { date: e.target.value })} />
                    </div>
                    <button 
                      onClick={() => deleteDoc(doc(db, 'expenses', exp.id))} 
                      className="text-slate-200 hover:text-red-400 p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 mb-8 space-y-3">
          <button 
            onClick={handleClearAll} 
            className="w-full py-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-600 hover:text-white transition-all shadow-sm touch-manipulation"
          >
            <Eraser size={14}/> Clear All Transactions
          </button>
          
          <button 
            onClick={handleExportCSV} 
            className="w-full py-4 bg-slate-100 text-slate-700 rounded-2xl border border-slate-200 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-200 transition-all shadow-sm touch-manipulation"
          >
            <Download size={14}/> Export to CSV
          </button>
        </div>
      </main>

      {/* Floating total display pop-up when lines are selected */}
      {selectedExpenseIds.length > 0 && (
        <div className="fixed bottom-6 left-0 right-0 px-4 z-50 pointer-events-none flex justify-center animate-slideUp">
          <div className="pointer-events-auto bg-slate-900/95 backdrop-blur text-white py-3.5 px-6 rounded-2xl shadow-2xl border border-slate-800 flex items-center justify-between gap-6 max-w-sm w-full">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                Selected ({selectedExpenseIds.length})
              </span>
              <span className="text-xl font-black text-emerald-400">
                ${selectedLinesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <button 
              onClick={() => setSelectedExpenseIds([])} 
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors touch-manipulation"
              title="Clear selection"
            >
              <X size={16} className="stroke-[2.5]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}