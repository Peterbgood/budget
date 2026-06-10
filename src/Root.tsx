import { useState, useEffect } from 'react';
import { LayoutList, Lock } from 'lucide-react';
import App from './App';
import FixedExpenses from './FixedExpenses';

type Tab = 'tracker' | 'fixed';

// NOTE: Move to an env variable (e.g. VITE_APP_PIN) for any non-personal deployment.
const APP_PIN = "3270";

export default function Root() {
  const [activeTab, setActiveTab] = useState<Tab>('tracker');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");

  // ── PIN screen keyboard listener ────────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        if (pinInput.length < 4) setPinInput(prev => prev + e.key);
      } else if (e.key === 'Backspace') {
        setPinInput(prev => prev.slice(0, -1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pinInput, isAuthenticated]);

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

  // ── PIN Screen ──────────────────────────────────────────────────────────────
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
                className="h-20 rounded-2xl bg-[#1c1c1e] text-2xl font-medium active:bg-[#3a3a3c] transition-all touch-manipulation"
              >
                {n}
              </button>
            ))}
            <button onClick={() => setPinInput("")} className="h-20 rounded-2xl bg-[#1c1c1e] text-xl font-medium active:bg-[#3a3a3c] transition-all touch-manipulation">C</button>
            <button onClick={() => pinInput.length < 4 && setPinInput(prev => prev + "0")} className="h-20 rounded-2xl bg-[#1c1c1e] text-2xl font-medium active:bg-[#3a3a3c] transition-all touch-manipulation">0</button>
            <button onClick={() => setPinInput(prev => prev.slice(0, -1))} className="h-20 rounded-2xl bg-[#1c1c1e] flex items-center justify-center active:bg-[#3a3a3c] transition-all touch-manipulation">
              <svg width="28" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff453a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                <line x1="18" y1="9" x2="12" y2="15" />
                <line x1="12" y1="9" x2="18" y2="15" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main UI ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen bg-black">

      {/* ── Page content ── */}
      <div className={activeTab === 'tracker' ? 'block' : 'hidden'}>
        <App />
      </div>
      <div className={activeTab === 'fixed' ? 'block' : 'hidden'}>
        <FixedExpenses />
      </div>

      {/* ── Bottom tab bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur border-t border-zinc-800/60 flex">
        <button
          onClick={() => setActiveTab('tracker')}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors touch-manipulation ${
            activeTab === 'tracker' ? 'text-blue-400' : 'text-zinc-600 hover:text-zinc-400'
          }`}
        >
          <LayoutList size={20} className="stroke-[2]" />
          <span className="text-[9px] font-black uppercase tracking-widest">Tracker</span>
        </button>

        <button
          onClick={() => setActiveTab('fixed')}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors touch-manipulation ${
            activeTab === 'fixed' ? 'text-blue-400' : 'text-zinc-600 hover:text-zinc-400'
          }`}
        >
          <Lock size={20} className="stroke-[2]" />
          <span className="text-[9px] font-black uppercase tracking-widest">Fixed</span>
        </button>
      </nav>

    </div>
  );
}