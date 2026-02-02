
import * as React from 'react';
import { User, Product, Invoice, AppSettings, InvoiceItem, SyncStatus } from '../types';
import Receipt from './Receipt';

const { useState, useMemo, useEffect, useCallback, memo } = React;

interface CartLineItem {
  lineId: string;
  productId: string;
  quantity: number;
  price: number;
  name: string;
  unit: string;
  gstRate: number;
}

// Optimized Product Card with memoization for smooth grid performance
const ProductCard = memo(({ product, onAdd }: { product: Product, onAdd: (p: Product) => void }) => (
  <button 
    onClick={() => onAdd(product)} 
    className="bg-white border-2 border-slate-200 p-4 rounded-3xl h-36 flex flex-col justify-between text-left hover:border-indigo-600 transition-all active:scale-95 shadow-sm will-change-transform"
    style={{ contentVisibility: 'auto' } as any}
  >
    <div>
      <span className="text-[7px] font-black text-indigo-500 uppercase tracking-widest">{product.itemCode}</span>
      <h3 className="text-[11px] font-black uppercase leading-tight mt-1 line-clamp-3 italic tracking-tighter">{product.name}</h3>
    </div>
    <div className="flex justify-between items-end">
      <span className="text-sm font-black text-slate-900">₹{product.price}</span>
      <span className="text-[7px] font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-400 uppercase">{product.unit}</span>
    </div>
  </button>
));

// Optimized Cart Item for smooth list scrolling
const CartItem = memo(({ item, onUpdate, onRemove }: { 
  item: CartLineItem, 
  onUpdate: (id: string, delta: number) => void, 
  onRemove: (id: string) => void 
}) => (
  <div className="bg-white border-2 border-slate-900 p-5 rounded-[2.5rem] shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] animate-fadeIn will-change-transform">
    <div className="flex justify-between items-start mb-4">
      <h4 className="text-[11px] font-black uppercase italic tracking-tighter pr-6 leading-tight">{item.name}</h4>
      <button onClick={() => onRemove(item.lineId)} className="text-red-400 p-2 hover:bg-red-50 rounded-full transition-colors">
        <i className="fas fa-trash-alt text-xs"></i>
      </button>
    </div>
    <div className="flex items-center justify-between border-t border-slate-100 pt-4">
      <div className="flex items-center bg-slate-900 rounded-2xl p-1">
        <button onClick={() => onUpdate(item.lineId, -1)} className="w-8 h-8 text-white hover:bg-slate-800 rounded-xl transition-colors"><i className="fas fa-minus text-[8px]"></i></button>
        <span className="w-10 text-center text-white font-black text-sm">{item.quantity}</span>
        <button onClick={() => onUpdate(item.lineId, 1)} className="w-8 h-8 text-white hover:bg-slate-800 rounded-xl transition-colors"><i className="fas fa-plus text-[8px]"></i></button>
      </div>
      <div className="text-right">
        <span className="text-lg font-black italic tracking-tighter">₹{(item.price * item.quantity).toLocaleString()}</span>
      </div>
    </div>
  </div>
));

interface POSProps {
  user: User;
  products: Product[];
  settings: AppSettings;
  onLogout: () => void;
  onSaveInvoice: (invoice: Invoice) => void;
  onUpdateSettings: (settings: AppSettings) => void;
  syncStatus: SyncStatus;
  onConnectHub: (id: string) => void;
}

const DevicePOS: React.FC<POSProps> = ({ user, products, settings, onLogout, onSaveInvoice, onUpdateSettings, syncStatus, onConnectHub }) => {
  const [cart, setCart] = useState<CartLineItem[]>(() => {
    const saved = localStorage.getItem('bb_pos_cart_v2');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showHubModal, setShowHubModal] = useState(false);
  const [hubInput, setHubInput] = useState('');
  const [currentReceipt, setCurrentReceipt] = useState<Invoice | null>(null);

  useEffect(() => {
    localStorage.setItem('bb_pos_cart_v2', JSON.stringify(cart));
  }, [cart]);

  const activeCompany = useMemo(() => settings.companies.find(c => c.id === settings.activeCompanyId) || settings.companies[0], [settings]);
  
  const filteredProducts = useMemo(() => {
    const p = products.filter(p => p.companyId === settings.activeCompanyId);
    if (!searchTerm) return p;
    const lowerSearch = searchTerm.toLowerCase();
    return p.filter(item => item.name.toLowerCase().includes(lowerSearch) || item.itemCode.toLowerCase().includes(lowerSearch));
  }, [products, settings.activeCompanyId, searchTerm]);

  const totalAmount = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [cart]);

  const addToCart = useCallback((p: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === p.id);
      if (existing) {
        return prev.map(i => i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { lineId: `li-${Date.now()}`, productId: p.id, quantity: 1, price: p.price, name: p.name, unit: p.unit, gstRate: p.gstRate }];
    });
  }, []);

  const updateQuantity = useCallback((id: string, delta: number) => {
    setCart(prev => prev.map(i => i.lineId === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart(prev => prev.filter(i => i.lineId !== id));
  }, []);

  const completeSale = () => {
    if (cart.length === 0) return;
    const inv: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `${activeCompany.invoicePrefix}-${Math.floor(1000 + Math.random() * 8999)}`,
      date: new Date().toISOString(),
      items: cart.map(i => ({ ...i, total: i.price * i.quantity, itemCode: 'N/A' })),
      totalAmount,
      gstAmount: 0,
      baseAmount: totalAmount,
      deviceId: user.id,
      deviceName: user.deviceName || user.username,
      companyId: activeCompany.id,
      gstin: activeCompany.gstin,
      paymentMethod: 'CASH',
      companyName: activeCompany.name,
      companyNameSecondary: activeCompany.nameSecondary
    };
    onSaveInvoice(inv);
    setCurrentReceipt(inv);
    setCart([]);
  };

  return (
    <div className="h-screen bg-slate-50 flex flex-col no-print overflow-hidden">
      <header className="bg-white border-b-2 border-slate-900 px-4 py-3 flex justify-between items-center shrink-0 z-50 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 text-white w-9 h-9 flex items-center justify-center rounded-xl rotate-3 shadow-lg">
             <i className="fas fa-bolt text-xs"></i>
          </div>
          <div>
             <h1 className="text-[12px] font-black uppercase italic tracking-tighter leading-none">BharatBill POS</h1>
             <p className="text-[7px] font-bold text-slate-400 uppercase mt-1">Terminal: {user.username}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button onClick={() => setShowHubModal(true)} className={`px-4 py-2 rounded-xl border-2 flex items-center space-x-2 transition-all ${syncStatus.connectedPeers.length > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
             <i className={`fas fa-circle text-[6px] ${syncStatus.isSyncing ? 'animate-pulse' : ''}`}></i>
             <span className="text-[8px] font-black uppercase tracking-widest">{syncStatus.connectedPeers.length > 0 ? 'Linked' : 'Offline'}</span>
          </button>
          <button onClick={onLogout} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[8px] font-black uppercase hover:bg-slate-800 transition-colors">Exit</button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Scrollable Catalog with high-performance CSS */}
        <div className="flex-1 flex flex-col min-w-0">
           <div className="p-4 border-b border-slate-100 bg-white/50 backdrop-blur-md">
              <div className="relative">
                 <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                 <input type="text" placeholder="Search Inventory..." className="w-full bg-white border-2 border-slate-200 rounded-2xl p-4 pl-12 font-black uppercase italic text-sm outline-none focus:border-indigo-600 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
           </div>
           <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 content-start smooth-scroll scroll-smooth overscroll-contain">
              {filteredProducts.map(p => (
                <ProductCard key={p.id} product={p} onAdd={addToCart} />
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full py-20 text-center opacity-20 flex flex-col items-center">
                  <i className="fas fa-box-open text-4xl mb-4"></i>
                  <p className="text-[10px] font-black uppercase tracking-widest">No matching items found</p>
                </div>
              )}
           </div>
        </div>

        {/* Optimized Cart Sidebar */}
        <div className="w-80 md:w-[420px] bg-white border-l-2 border-slate-900 flex flex-col shadow-2xl z-40">
           <div className="p-6 bg-slate-900 text-white shrink-0">
              <div className="flex justify-between items-end mb-5">
                 <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Grand Total</span>
                    <span className="text-4xl font-black italic tracking-tighter">₹{totalAmount.toLocaleString()}</span>
                 </div>
                 <button onClick={() => { if(confirm('Clear entire cart?')) setCart([]); }} className="text-[8px] font-black text-slate-500 hover:text-red-400 uppercase tracking-widest transition-colors">Clear All</button>
              </div>
              <button disabled={cart.length === 0} onClick={completeSale} className="w-full bg-white text-slate-900 font-black py-5 rounded-[2rem] uppercase text-[12px] tracking-widest active:scale-95 disabled:opacity-20 transition-all shadow-xl">Complete Sale</button>
           </div>

           <div className="flex-1 overflow-y-auto p-5 space-y-4 smooth-scroll overscroll-contain bg-slate-50/20 scroll-smooth">
              {cart.map(item => (
                <CartItem key={item.lineId} item={item} onUpdate={updateQuantity} onRemove={removeFromCart} />
              ))}
              {cart.length === 0 && <div className="h-full flex flex-col items-center justify-center opacity-10 text-center p-10"><i className="fas fa-shopping-basket text-5xl mb-4"></i><p className="text-[10px] font-black uppercase tracking-widest">Ready for Sale</p></div>}
              <div className="h-10 shrink-0"></div>
           </div>
        </div>
      </div>

      {showHubModal && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[500] flex items-center justify-center p-6 animate-fadeIn">
           <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-12 border-4 border-indigo-600 shadow-2xl relative">
              <button onClick={() => setShowHubModal(false)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 transition-colors"><i className="fas fa-times"></i></button>
              <div className="text-center mb-10">
                 <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-3xl shadow-inner border border-indigo-100">
                    <i className="fas fa-network-wired"></i>
                 </div>
                 <h3 className="text-2xl font-black uppercase italic tracking-tighter">Link Hub</h3>
                 <p className="text-[9px] font-black text-slate-400 uppercase mt-2 tracking-widest leading-relaxed">Connect to HQ to sync inventory and sales across nodes instantly.</p>
              </div>
              <input type="text" placeholder="Enter Hub ID..." className="w-full bg-slate-50 border-4 border-slate-900 p-6 rounded-[2rem] font-black text-lg text-center outline-none focus:border-indigo-600 uppercase italic mb-6 shadow-inner" value={hubInput} onChange={e => setHubInput(e.target.value)} />
              <button onClick={() => { onConnectHub(hubInput); setShowHubModal(false); }} className="w-full bg-indigo-600 text-white font-black py-6 rounded-[2rem] uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95 hover:bg-indigo-700">Connect Now</button>
           </div>
        </div>
      )}

      {currentReceipt && <Receipt invoice={currentReceipt} onClose={() => setCurrentReceipt(null)} />}
    </div>
  );
};

export default DevicePOS;
