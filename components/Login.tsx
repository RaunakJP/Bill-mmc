
import React, { useState, useEffect } from 'react';
import { User } from '../types';

interface LoginProps {
  users: User[];
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ users, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    setIsIos(/iphone|ipad|ipod/.test(ua));
    
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(!!isPWA);

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('App Download engine ready!');
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      onLogin(user);
    } else {
      setError('Invalid Terminal ID or Access Key');
    }
  };

  const handleAndroidInstall = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
        }
      } catch (err) {
        setShowInstallGuide(true);
      }
    } else {
      // If no prompt, it might already be installed or browser doesn't support it
      alert("Android: Open this site in Chrome, tap menu (three dots), and select 'Install App' or 'Add to Home screen'.");
    }
  };

  const handleIosInstall = () => {
    setShowInstallGuide(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F172A] p-4 sm:p-6 overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600 rounded-full blur-[120px]"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px]"></div>
      </div>

      <div className="bg-white rounded-[3.5rem] shadow-2xl p-8 sm:p-12 w-full max-w-md relative z-10 border border-white/20">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600 text-white rounded-[2.2rem] mb-6 shadow-2xl shadow-indigo-500/40 -rotate-3 border-4 border-white">
            <i className="fas fa-file-invoice-dollar text-3xl"></i>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
            BharatBill <span className="text-indigo-600">Pro</span>
          </h1>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.4em] mt-3">
            Mahavir Matching Centre
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 mb-8">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center animate-shake border border-red-100">
              <i className="fas fa-exclamation-circle mr-3 text-sm"></i>
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Terminal ID</label>
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 pl-5 flex items-center text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                <i className="fas fa-id-badge text-sm"></i>
              </span>
              <input
                type="text"
                className="block w-full pl-12 pr-4 py-5 bg-slate-50 border-2 border-transparent rounded-2xl font-black text-sm outline-none focus:bg-white focus:border-indigo-600 transition-all uppercase placeholder:text-slate-300"
                placeholder="MMC"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Access Key</label>
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 pl-5 flex items-center text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                <i className="fas fa-key text-sm"></i>
              </span>
              <input
                type="password"
                className="block w-full pl-12 pr-4 py-5 bg-slate-50 border-2 border-transparent rounded-2xl font-black text-sm outline-none focus:bg-white focus:border-indigo-600 transition-all placeholder:text-slate-300"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 px-4 rounded-2xl shadow-xl shadow-indigo-500/30 transform active:scale-[0.98] transition-all uppercase tracking-widest text-xs flex items-center justify-center space-x-3"
          >
            <span>Make a Bill</span>
            <i className="fas fa-arrow-right text-[10px]"></i>
          </button>
        </form>

        {!isStandalone && (
          <div className="pt-8 border-t-2 border-dashed border-slate-100 text-center">
            <p className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-6 flex items-center justify-center">
              <span className="w-8 h-[2px] bg-indigo-100 mr-2"></span>
              DOWNLOAD MOBILE APP
              <span className="w-8 h-[2px] bg-indigo-100 ml-2"></span>
            </p>
            
            <div className="grid grid-cols-1 gap-4">
              {/* Android Download Button */}
              <button 
                onClick={handleAndroidInstall}
                className="flex items-center bg-black text-white p-3 rounded-xl hover:bg-slate-800 transition-all active:scale-[0.98] shadow-lg text-left"
              >
                <div className="w-8 h-8 flex items-center justify-center mr-3">
                  <i className="fab fa-google-play text-xl text-green-400"></i>
                </div>
                <div>
                  <p className="text-[7px] font-bold uppercase leading-none opacity-60">GET IT ON</p>
                  <p className="text-[14px] font-black uppercase leading-tight">Google Play</p>
                </div>
                <i className="fas fa-arrow-down ml-auto text-[10px] opacity-20"></i>
              </button>

              {/* iOS Download Button */}
              <button 
                onClick={handleIosInstall}
                className="flex items-center bg-black text-white p-3 rounded-xl hover:bg-slate-800 transition-all active:scale-[0.98] shadow-lg text-left"
              >
                <div className="w-8 h-8 flex items-center justify-center mr-3">
                  <i className="fab fa-apple text-2xl"></i>
                </div>
                <div>
                  <p className="text-[7px] font-bold uppercase leading-none opacity-60">Download on the</p>
                  <p className="text-[14px] font-black uppercase leading-tight">App Store</p>
                </div>
                <i className="fas fa-arrow-down ml-auto text-[10px] opacity-20"></i>
              </button>
            </div>
            
            <p className="mt-4 text-[7px] font-black text-slate-400 uppercase tracking-tight">
              Instant installation using PWA technology
            </p>
          </div>
        )}

        {isStandalone && (
          <div className="mt-8 pt-6 border-t border-slate-50 text-center">
            <div className="flex items-center justify-center space-x-2 text-green-500 bg-green-50 py-3 rounded-xl border border-green-100">
               <i className="fas fa-check-circle text-xs"></i>
               <span className="text-[9px] font-black uppercase tracking-widest">Enterprise App Active</span>
            </div>
          </div>
        )}
      </div>

      {showInstallGuide && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-2xl z-[500] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-t-[3.5rem] sm:rounded-[4rem] p-10 pb-12 sm:p-14 border-t-8 border-indigo-600 shadow-2xl relative animate-slideUp">
             
             <button onClick={() => setShowInstallGuide(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 transition-all w-12 h-12 flex items-center justify-center bg-slate-50 rounded-full active:scale-90">
                <i className="fas fa-times text-sm"></i>
             </button>

             <div className="text-center mb-10">
                <div className="w-20 h-20 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-indigo-600 text-3xl shadow-inner border-2 border-indigo-100">
                   <i className={`fas fa-${isIos ? 'mobile-screen-button' : 'download'}`}></i>
                </div>
                <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter leading-tight">Install Guide</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Finish download in 3 steps</p>
             </div>

             <div className="space-y-8">
                <div className="flex items-start space-x-5 group">
                   <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-sm flex-shrink-0 group-hover:bg-indigo-600 transition-colors shadow-lg">1</div>
                   <div className="pt-1">
                      <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">Open Safari/Browser Menu</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 leading-relaxed">
                        Tap <i className={`fas fa-${isIos ? 'share-from-square' : 'ellipsis-vertical'} text-indigo-600 mx-1`}></i> in your browser toolbar.
                      </p>
                   </div>
                </div>
                <div className="flex items-start space-x-5 group">
                   <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-sm flex-shrink-0 group-hover:bg-indigo-600 transition-colors shadow-lg">2</div>
                   <div className="pt-1">
                      <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">Select "Add to Home Screen"</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 leading-relaxed">Scroll and tap the "Add to Home Screen" or "Install App" button.</p>
                   </div>
                </div>
                <div className="flex items-start space-x-5 group">
                   <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-sm flex-shrink-0 group-hover:bg-indigo-600 transition-colors shadow-lg">3</div>
                   <div className="pt-1">
                      <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">Launch the Icon</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 leading-relaxed">The BharatBill Pro icon will appear on your home screen. Open it to start billing.</p>
                   </div>
                </div>
             </div>

             <button onClick={() => setShowInstallGuide(false)} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl uppercase text-[11px] tracking-widest mt-12 shadow-2xl shadow-indigo-500/20 active:scale-95 transition-all">Dismiss</button>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
        .animate-slideUp { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};

export default Login;
