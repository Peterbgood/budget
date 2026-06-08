import { useState, useEffect, useMemo, useRef } from 'react'; 
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, query, orderBy, onSnapshot, 
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc, writeBatch 
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { Trash2, Calendar, ReceiptText, PieChart as PieIcon, X, Eraser, ClipboardCopy, Plus, Check, Clock } from 'lucide-react';

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

const DEFAULT_CATEGORIES = [
  'Walmart', 'Chick-fil-A', 'McDonald\'s', "Salsarita's", 
  'Food City', 'Target', 'Publix', 'Panda Express', 'Kroger', 
  'Freddy\'s', 'Starbucks', 'Taco Bell', 'Dunkin', 'Amazon', 'Gas', 'Little Caesars', 'Panera', 'Cash'
];

const APP_PIN = "3270";

export default function App() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<{ name: string; amount: number } | null>(null);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const amountInputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  // Dynamic Categories initialized from localStorage or defaults
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('budget_categories');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  
  // Track which category button is currently showing the inline confirmation state
  const [categoryDeletingName, setCategoryDeletingName] = useState<string | null>(null);

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
  }, []);

  useEffect(() => {
    localStorage.setItem('budget_categories', JSON.stringify(categories));
  }, [categories]);

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
        if (timeA !== null && timeB !== null) return timeB - timeA;
        return b.id.localeCompare(a.id);
      });

      setExpenses(sortedData);
      setLoading(false);
    });

    return () => {
      unsubBudget();
      unsubExpenses();
    };
  }, [isAuthenticated]);

  // Handle outside pointers resetting any inline configurations
  useEffect(() => {
    if (!deletingId && !categoryDeletingName) return;
    const handleGlobalClick = () => {
      setDeletingId(null);
      setCategoryDeletingName(null);
    };
    window.addEventListener('pointerdown', handleGlobalClick);
    return () => window.removeEventListener('pointerdown', handleGlobalClick);
  }, [deletingId, categoryDeletingName]);

  useEffect(() => {
    if (justAddedId && amountInputsRef.current[justAddedId]) {
      const targetInput = amountInputsRef.current[justAddedId];
      if (targetInput) {
        setTimeout(() => {
          targetInput.focus();
          targetInput.select();
          targetInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
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

  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    
    if (categories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      window.alert("Category already exists!");
      return;
    }

    setCategories(prev => [...prev, trimmed]);
    setNewCategoryInput("");
    setIsModalOpen(false);
  };

  const handleClearAll = async () => {
    // Keep internal logic without prompt since native alerts are blocked
    const batch = writeBatch(db);
    expenses.forEach(exp => batch.delete(doc(db, 'expenses', exp.id)));
    await batch.commit();
    setSelectedExpenseIds([]);
  };

  const handleCopyToClipboard = async () => {
    if (expenses.length === 0) {
      window.alert("No transactions to export.");
      return;
    }
    
    const headers = ["Date", "Category", "Amount ($)"];
    const rows = expenses.map(exp => [
      exp.date,
      exp.category,
      exp.amount.toFixed(2)
    ]);
    
    const spreadsheetContent = [headers.join("\t"), ...rows.map(e => e.join("\t"))].join("\n");
    
    try {
      await navigator.clipboard.writeText(spreadsheetContent);
      window.alert("Spreadsheet rows copied to clipboard! Paste (Ctrl+V) directly into Google Sheets.");
    } catch (err) {
      console.error("Clipboard copy failure:", err);
    }
  };

  const handleAmountMaskChange = (rawInputValue: string): number => {
    const digitsOnly = rawInputValue.replace(/\D/g, "");
    if (!digitsOnly) return 0;
    return parseInt(digitsOnly, 10) / 100;
  };

  const totalSpent = useMemo(() => expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0), [expenses]);
  const remaining = monthlyBudget - totalSpent;

  const daysUntilNext13th = useMemo(() => {
    const today = new Date();
    let targetYear = today.getFullYear();
    let targetMonth = today.getMonth();

    if (today.getDate() >= 13) {
      targetMonth += 1;
      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear += 1;
      }
    }

    const targetDate = new Date(targetYear, targetMonth, 13);
    const currentMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const differenceInMs = targetDate.getTime() - currentMidnight.getTime();
    return Math.ceil(differenceInMs / (1000 * 60 * 60 * 24));
  }, []);

  const categoryTotalsMap = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + (Number(e.amount) || 0);
    });
    return map;
  }, [expenses]);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const totalA = categoryTotalsMap[a] || 0;
      const totalB = categoryTotalsMap[b] || 0;
      return totalB - totalA;
    });
  }, [categoryTotalsMap, categories]);

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
      <div className="h-screen bg-black flex flex-col items-center justify-center p-6 text-white">
        <div className="w-full max-w-[300px] flex flex-col items-center">
          <p className="text-2xl font-bold mb-8">Enter PIN</p>
          
          <div className="flex gap-4 mb-10">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`w-3 h-3 rounded-full transition-all duration-200 ${pinInput.length > i ? 'bg-white' : 'bg-white/20'}`} />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 select-none w-full">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
              <button 
                key={n} 
                onClick={() => pinInput.length < 4 && setPinInput(prev => prev + n)} 
                className="h-20 rounded-2xl bg-[#1c1c1e] text-2xl font-medium active:bg-[#3a3a3c] transition-all"
              >
                {n}
              </button>
            ))}
            <button onClick={() => setPinInput("")} className="h-20 rounded-2xl bg-[#1c1c1e] text-xl font-medium active:bg-[#3a3a3c] transition-all">C</button>
            <button onClick={() => pinInput.length < 4 && setPinInput(prev => prev + "0")} className="h-20 rounded-2xl bg-[#1c1c1e] text-2xl font-medium active:bg-[#3a3a3c] transition-all">0</button>
            <button onClick={() => setPinInput(prev => prev.slice(0, -1))} className="h-20 rounded-2xl bg-[#1c1c1e] flex items-center justify-center active:bg-[#3a3a3c] transition-all">
              <svg width="28" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff453a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <div className="h-screen bg-zinc-950 flex items-center justify-center font-black text-zinc-700 uppercase tracking-widest">Syncing...</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-32">
      <div className="px-4 pt-6 mb-6">
        <div className="max-w-xl mx-auto bg-zinc-900 rounded-3xl shadow-xl p-6 border border-zinc-800/80">
          <div className="text-center mb-6 relative">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Remaining</p>
            <div className="flex flex-col items-center justify-center relative">
              <p className={`text-4xl font-black ${remaining < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {remaining < 0 ? '-' : ''}${Math.abs(remaining).toFixed(2)}
              </p>
              <div className="mt-1 flex items-center gap-1 text-[9px] font-black uppercase text-zinc-400 bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded-full shadow-inner tracking-wider">
                <Clock size={10} className="text-zinc-500" />
                <span>{daysUntilNext13th} days left until 13th</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 border-t border-zinc-800 pt-4">
            <div className="text-center border-r border-zinc-800">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Budget</p>
              <div className="flex items-center justify-center gap-1">
                <span className="text-xl font-black text-zinc-700">$</span>
                <input 
                  type="text" 
                  inputMode="numeric"
                  className="text-2xl font-black focus:outline-none w-28 bg-transparent text-center text-zinc-100" 
                  value={(monthlyBudget || 0).toFixed(2)} 
                  onChange={(e) => {
                    const val = handleAmountMaskChange(e.target.value);
                    setMonthlyBudget(val);
                    setDoc(doc(db, 'budgets', 'main_config'), { monthlyBudget: val }, { merge: true });
                  }} 
                />
              </div>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Spent</p>
              <p className="text-2xl font-black text-zinc-200">${totalSpent.toFixed(2)}</p>
            </div>
          </div>
          
          <div className="mt-4">
             <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-1">
               <PieIcon size={12} /> Visual Breakdown
             </p>
             <div className="flex h-8 w-full rounded-xl overflow-hidden bg-zinc-950 shadow-inner mb-4">
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
                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-zinc-800 text-zinc-100 text-[10px] py-1 px-2 rounded whitespace-nowrap z-50 shadow-lg border border-zinc-700">
                      {cat}: ${Number(val).toFixed(2)}
                    </div>
                 </div>
               ))}
             </div>

             {selectedCategory && (
               <div className="mb-4 p-3 bg-zinc-800/40 border border-zinc-800 rounded-xl flex items-center justify-between animate-fadeIn">
                 <div className="text-[11px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                   Selected: <span className="text-zinc-100">{selectedCategory.name}</span>
                 </div>
                 <div className="flex items-center gap-3">
                   <span className="text-sm font-black text-blue-400">${selectedCategory.amount.toFixed(2)}</span>
                   <button onClick={() => setSelectedCategory(null)} className="text-zinc-500 hover:text-zinc-300"><X size={14}/></button>
                 </div>
               </div>
             )}
          </div>
        </div>
      </div>

      <main className="max-w-xl mx-auto px-4 mt-8">
        <div className="grid grid-cols-3 gap-1.5 mb-8">
          {sortedCategories.map(cat => {
            const catTotal = categoryTotalsMap[cat] || 0;
            const isStagingCategoryDelete = categoryDeletingName === cat;

            return (
              <div key={cat} className="relative group">
                {isStagingCategoryDelete ? (
                  <button 
                    type="button"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setCategories(prev => prev.filter(c => c !== cat));
                      setCategoryDeletingName(null);
                    }}
                    className="w-full bg-red-600 text-white border border-red-500 rounded-lg text-[8px] font-black tracking-wider uppercase flex items-center justify-center min-h-[44px] animate-fadeIn touch-manipulation"
                  >
                    CONFIRM?
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={() => handleAddNewExpense(cat)} 
                      className="w-full py-1 px-1 bg-zinc-900 border border-zinc-800/60 rounded-lg text-[8px] leading-tight font-black text-zinc-300 shadow-sm active:bg-blue-600 active:text-white transition-all uppercase truncate flex flex-col items-center justify-center min-h-[44px] touch-manipulation"
                    >
                      <span className="truncate pr-2">{cat}</span>
                      {catTotal > 0 && <span className="text-zinc-500 font-bold shrink-0">(${catTotal.toFixed(2)})</span>}
                    </button>
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setCategoryDeletingName(cat);
                      }}
                      className="absolute top-0.5 right-0.5 text-zinc-600 hover:text-red-400 active:text-red-500 p-0.5 rounded transition-colors touch-manipulation"
                      title={`Delete ${cat}`}
                    >
                      <X size={8} className="stroke-[3]" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
          
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="py-1 px-1 bg-zinc-900 border border-zinc-800 rounded-lg text-[9px] leading-tight font-black text-blue-400 shadow-sm active:bg-blue-600 active:text-white transition-all uppercase flex flex-col items-center justify-center min-h-[44px] touch-manipulation gap-0.5"
          >
            <Plus size={12} className="stroke-[3]" />
            <span>Add New</span>
          </button>
        </div>

        <div className="space-y-3">
          <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2"><ReceiptText size={12}/> History</h2>
          {expenses.map(exp => {
            const isSelected = selectedExpenseIds.includes(exp.id);
            const isStagingDelete = deletingId === exp.id;
            
            return (
              <div 
                key={exp.id} 
                className={`p-4 rounded-2xl border transition-all duration-150 flex items-center gap-3.5 shadow-sm select-none ${
                  isSelected 
                    ? 'bg-blue-950/40 border-blue-800 ring-2 ring-blue-500/20' 
                    : 'bg-zinc-900 border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-1">
                    <input className="font-black text-zinc-100 bg-transparent focus:outline-none w-full" value={exp.category} onChange={(e) => updateDoc(doc(db, 'expenses', exp.id), { category: e.target.value })} />
                    <div className="flex items-center text-blue-400 font-black">
                      <span className="text-sm mr-0.5">$</span>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        ref={el => { amountInputsRef.current[exp.id] = el; }}
                        className="w-20 text-right bg-transparent focus:outline-none text-zinc-100" 
                        value={(exp.amount || 0).toFixed(2)} 
                        onChange={(e) => {
                          const val = handleAmountMaskChange(e.target.value);
                          updateDoc(doc(db, 'expenses', exp.id), { amount: val });
                        }} 
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-zinc-500 items-center min-h-[24px]">
                    <div className="flex items-center gap-1">
                      <Calendar size={12} />
                      <input type="date" className="text-[10px] bg-transparent focus:outline-none font-bold uppercase text-zinc-400" value={exp.date} onChange={(e) => updateDoc(doc(db, 'expenses', exp.id), { date: e.target.value })} />
                    </div>
                    
                    <div className="flex items-center gap-2 pointer-events-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleSelectExpense(exp.id)}
                        className={`w-6 h-6 rounded-lg border transition-all flex items-center justify-center touch-manipulation ${
                          isSelected 
                            ? 'bg-blue-500 border-blue-500 text-white shadow-sm' 
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                        }`}
                      >
                        {isSelected ? <Check size={12} className="stroke-[3]" /> : <Plus size={12} className="stroke-[3]" />}
                      </button>

                      <div className="relative">
                        {isStagingDelete ? (
                          <button 
                            type="button"
                            onPointerDown={(e) => {
                              e.stopPropagation(); 
                              deleteDoc(doc(db, 'expenses', exp.id));
                              setDeletingId(null);
                            }}
                            className="bg-red-500 text-white text-[9px] font-black tracking-wider uppercase px-2.5 py-1 rounded-lg shadow-sm hover:bg-red-600 animate-fadeIn shrink-0 touch-manipulation"
                          >
                            CONFIRM?
                          </button>
                        ) : (
                          <button 
                            type="button"
                            onPointerDown={(e) => {
                              e.stopPropagation(); 
                              setDeletingId(exp.id);
                            }} 
                            className="text-zinc-700 hover:text-red-400 p-1 rounded transition-colors touch-manipulation"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 mb-8 space-y-3">
          <button 
            onClick={handleClearAll} 
            className="w-full py-4 bg-red-950/20 text-red-400 rounded-2xl border border-red-900/50 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-900/40 transition-all shadow-sm touch-manipulation"
          >
            <Eraser size={14}/> Clear All Transactions
          </button>
          
          <button 
            onClick={handleCopyToClipboard} 
            className="w-full py-4 bg-zinc-900 text-zinc-300 rounded-2xl border border-zinc-800 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all shadow-sm touch-manipulation"
          >
            <ClipboardCopy size={14}/> Copy to Spreadsheet
          </button>
        </div>
      </main>

      {/* Dynamic Category Overlay Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                <Plus size={14} className="text-blue-400" /> Add Custom Category
              </h3>
              <button 
                onClick={() => { setIsModalOpen(false); setNewCategoryInput(""); }}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAddCategorySubmit} className="space-y-4">
              <input 
                type="text"
                autoFocus
                placeholder="e.g., Taco Bell, Home Depot..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 font-bold focus:outline-none focus:border-blue-500 transition-colors placeholder:text-zinc-600"
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
              />
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => { setIsModalOpen(false); setNewCategoryInput(""); }}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors"
                >
                  Add Button
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedExpenseIds.length > 0 && (
        <div className="fixed bottom-6 left-0 right-0 px-4 z-50 pointer-events-none flex justify-center animate-slideUp">
          <div className="pointer-events-auto bg-zinc-900/95 backdrop-blur text-white py-3.5 px-6 rounded-2xl shadow-2xl border border-zinc-800 flex items-center justify-between gap-6 max-w-sm w-full">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">
                Selected ({selectedExpenseIds.length})
              </span>
              <span className="text-xl font-black text-emerald-400">
                ${selectedLinesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <button 
              onClick={() => setSelectedExpenseIds([])} 
              className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white transition-colors touch-manipulation"
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