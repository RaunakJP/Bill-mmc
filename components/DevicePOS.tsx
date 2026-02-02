import * as React from 'react';
import { User, Product, Invoice, AppSettings, InvoiceItem, PrinterConfig, Company } from '../types';
import Receipt from './Receipt';

const { useState, useMemo, useEffect, useRef } = React;

interface CartLineItem {
  lineId: string;
  productId: string;
  quantity: number;
  price: number;
  name: string;
  unit: string;
  gstRate: number;
}

interface POSProps {
  user: User;
  products: Product[];
  settings: AppSettings;
  onLogout: () => void;
  onSaveInvoice: (invoice: Invoice) => void;
  onUpdateSettings: (settings: AppSettings) => void;
}

const DevicePOS: React.FC<POSProps> = ({ user, products, settings, onLogout, onSaveInvoice, onUpdateSettings }) => {
  const [cart, setCart] = useState<CartLineItem[]>(() => {
    const saved = localStorage.getItem('bb_pos_cart_v2');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [customerName, setCustomerName] = useState(() => localStorage.getItem('bb_pos_customer_name') || '');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI'>('CASH');
  const [currentReceipt, setCurrentReceipt] = useState<Invoice | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  
  const cartContainerRef = useRef<HTMLDivElement>(null);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [entryQty, setEntryQty] = useState<string>('1');
  const [entryPrice, setEntryPrice] = useState<string>('0');
  const qtyModalInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('bb_pos_cart_v2', JSON.stringify(cart));
  }, [cart]);

  const activeCompany = useMemo(() => {
    return settings.companies.find(c => c.id === settings.activeCompanyId) || settings.companies[0];
  }, [settings.companies, settings.activeCompanyId]);

  const companyProducts = useMemo(() => {
    return products.filter(p => p.companyId === settings.activeCompanyId);
  }, [products, settings.activeCompanyId]);

  const financialTotals = useMemo(() => {
    return cart.reduce((acc, item) => {
      const total = item.price * item.quantity;
      const taxAmount = (total * item.gstRate) / (100 + item.gstRate);
      const baseAmount = total - taxAmount;
      return {
        grandTotal: acc.grandTotal + total,
        totalGst: acc.totalGst + taxAmount,
        totalBase: acc.totalBase + baseAmount
      };
    }, { grandTotal: 0, totalGst: 0, totalBase: 0 });
  }, [cart]);

  const handleProductClick = (p: Product) => {
    setPendingProduct(p);
    setEntryQty('1');
    setEntryPrice(p.price.toString());
  };

  const confirmAddToCart = () => {
    if (!pendingProduct) return;
    let qty = parseFloat(entryQty) || 0;
    if (pendingProduct.unit === 'pcs') {
      qty = Math.floor(qty);
    }
    const price = parseFloat(entryPrice) || 0;
    
    if (qty > 0) {
      const newLine: CartLineItem = {
        lineId: `line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        productId: pendingProduct.id,
        quantity: Number(qty.toFixed(3)),
        price: price,
        name: pendingProduct.name,
        unit: pendingProduct.unit,
        gstRate: pendingProduct.gstRate
      };
      setCart(prev => [...prev, newLine]);
      setSelectedLineId(newLine.lineId);
    }
    setPendingProduct(null);
  };

  const removeItem = (lineId: string) => {
    if (confirm('Delete this item from current bill?')) {
      setCart(prev => prev.filter(item => item.lineId !== lineId));
      if (selectedLineId === lineId) setSelectedLineId(null);
    }
  };

  const resetBill = () => {
    if (cart.length > 0 && confirm('Clear all items and reset the current bill?')) {
      setCart([]);
      setCustomerName('');
      setPaymentMethod('CASH');
      setSelectedLineId(null);
    }
  };

  const handleQuantityChange = (lineId: string, val: string, unit: string) => {
    let num = parseFloat(val) || 0;
    if (unit === 'pcs') {
      num = Math.floor(num);
    }
    setCart(prev => prev.map(i => i.lineId === lineId ? { ...i, quantity: num } : i));
  };

  const processBill = () => {
    if (cart.length === 0) return;
    const invoiceItems: InvoiceItem[] = cart.map(item => ({
      productId: item.productId,
      itemCode: products.find(p => p.id === item.productId)?.itemCode || 'N/A',
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      total: Number((item.price * item.quantity).toFixed(2)),
      unit: item.unit,
      gstRate: item.gstRate
    }));
    const newInvoice: Invoice = { 
      id: `inv-${Date.now()}`, 
      invoiceNumber: `${activeCompany.invoicePrefix}-${Math.floor(1000 + Math.random() * 9000)}`, 
      date: new Date().toISOString(), 
      items: invoiceItems, 
      totalAmount: Number(financialTotals.grandTotal.toFixed(2)), 
      gstAmount: Number(financialTotals.totalGst.toFixed(2)), 
      baseAmount: Number(financialTotals.totalBase.toFixed(2)), 
      deviceId: user.id, 
      deviceName: user.deviceName || user.username, 
      companyId: activeCompany.id,
      companyName: activeCompany.name, 
      companyNameSecondary: activeCompany.nameSecondary,
      headerTopLine: activeCompany.headerTopLine,
      gstin: activeCompany.gstin, 
      logoUrl: activeCompany.logoUrl,
      logoScale: activeCompany.logoScale,
      upiId: activeCompany.upiId,
      customerName,
      paymentMethod,
      addressLine1: activeCompany.addressLine1,
      addressLine2: activeCompany.addressLine2,
      contactNumber: activeCompany.contactNumber,
      email: activeCompany.email,
      termsLine1: activeCompany.termsLine1,
      termsLine2: activeCompany.termsLine2,
      thankYouEmojiStart: activeCompany.thankYouEmojiStart,
      thankYouEmojiEnd: activeCompany.thankYouEmojiEnd
    };
    onSaveInvoice(newInvoice);
    setCurrentReceipt(newInvoice);
    setCart([]); 
    setCustomerName('');
    setPaymentMethod('CASH');
    setSelectedLineId(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col no-print font-sans select-none overflow-hidden">
      <header className="bg-white border-b-2 border-slate-900 px-4 py-3 flex justify-between items-center z-50 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 text-white w-10 h-10 flex items-center justify-center rounded-xl shadow-lg rotate-3">
            <i className="fas fa-bolt text-xs"></i>
          </div>
          <div className="flex flex-col">
            <h1 className="font-black text-sm text-slate-900 uppercase italic leading-none tracking-tighter">BharatBill POS</h1>
            <span className="text-[7px] font-black text-slate-400 uppercase mt-1 tracking-widest">{user.deviceName} HUB</span>
          </div>
        </div>

        <div className="flex-1 max-w-sm mx-6 flex items-center space-x-4">
           <select 
             className="bg-slate-100 border-2 border-slate-900 py-2.5 px-4 rounded-xl font-black text-[9px] uppercase tracking-widest outline-none appearance-none"
             value={settings.activeCompanyId}
             onChange={(e) => { setCart([]); onUpdateSettings({ ...settings, activeCompanyId: e.target.value }); }}
           >
             {settings.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
           </select>
          <div className="relative group flex-1">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input type="text" placeholder="SEARCH CATALOG..." className="w-full pl-11 pr-4 py-3 bg-slate-100 border-2 border-transparent rounded-2xl text-[10px] font-black uppercase outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button onClick={onLogout} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase">Sign Out</button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-6 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 content-start bg-slate-50/50 custom-scrollbar overscroll-contain">
          {companyProducts.filter(p => !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.itemCode.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
            <button key={p.id} onClick={() => handleProductClick(p)} className="bg-white border-2 border-slate-200 p-4 rounded-2xl text-left h-36 flex flex-col justify-between hover:border-indigo-600 hover:shadow-xl transition-all group overflow-hidden">
              <div>
                <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">{p.itemCode}</span>
                <h3 className="font-black text-[12px] uppercase leading-tight mt-1 line-clamp-3 text-slate-900">{p.name}</h3>
              </div>
              <div className="flex justify-between items-end mt-auto">
                <span className="text-[13px] font-black text-slate-900">₹{p.price}</span>
                <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase ${p.unit === 'mtr' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                  {p.unit}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="w-[420px] bg-white border-l-2 border-slate-900 flex flex-col shadow-2xl relative">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
             <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-shopping-cart text-xs text-indigo-600"></i>
                </div>
                <div>
                  <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-900 leading-none">Live Invoice</h2>
                  <p className="text-[7px] text-slate-400 uppercase font-black mt-1">{cart.length} items</p>
                </div>
             </div>
             <button 
               onClick={resetBill}
               disabled={cart.length === 0}
               className={`text-[9px] font-black px-4 py-2 rounded-xl uppercase tracking-widest transition-all ${cart.length > 0 ? 'bg-red-500 text-white shadow-lg hover:bg-red-600 active:scale-95' : 'bg-slate-100 text-slate-300'}`}
             >
               <i className="fas fa-undo-alt mr-2"></i> Reset Bill
             </button>
          </div>

          <div className="p-6 bg-slate-900 text-white shrink-0 shadow-lg">
             <div className="flex justify-between items-end mb-5">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Grand Total</span>
                  <span className="text-4xl font-black tracking-tighter italic">₹{financialTotals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="text-right">
                   <p className="text-[8px] font-black text-slate-500 uppercase">Incl. GST: ₹{financialTotals.totalGst.toLocaleString()}</p>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-3 mb-5">
                <button onClick={() => setPaymentMethod('CASH')} className={`py-3 rounded-2xl border-4 font-black text-[10px] uppercase transition-all ${paymentMethod === 'CASH' ? 'bg-white text-slate-900 border-white' : 'bg-transparent text-slate-500 border-slate-800'}`}>CASH</button>
                <button onClick={() => setPaymentMethod('UPI')} className={`py-3 rounded-2xl border-4 font-black text-[10px] uppercase transition-all ${paymentMethod === 'UPI' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-transparent text-slate-500 border-slate-800'}`}>UPI / QR</button>
             </div>

             <button disabled={cart.length === 0} onClick={processBill} className="w-full bg-white text-slate-900 font-black py-5 rounded-[2rem] shadow-2xl uppercase text-[12px] tracking-[0.2em] active:scale-95 disabled:opacity-20 transition-all">Complete & Print</button>
          </div>

          <div className="flex-1 relative overflow-hidden bg-slate-50/30">
            <div 
              ref={cartContainerRef}
              className="absolute inset-0 overflow-y-auto p-5 space-y-4 custom-scrollbar overscroll-contain"
            >
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-10 pointer-events-none p-10 text-center">
                  <i className="fas fa-shopping-basket text-4xl mb-4"></i>
                  <p className="text-[10px] font-black uppercase tracking-widest">Cart is empty</p>
                </div>
              ) : (
                cart.map((item, index) => (
                  <div 
                    key={item.lineId} 
                    onClick={() => setSelectedLineId(item.lineId)}
                    className={`bg-white border-2 p-5 rounded-[2.5rem] flex flex-col transition-all duration-300 cursor-pointer ${selectedLineId === item.lineId ? 'border-indigo-600 bg-indigo-50/30 shadow-indigo-100 ring-4 ring-indigo-100 shadow-xl' : 'border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] hover:border-slate-400'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-black text-[12px] uppercase text-slate-900 tracking-tight leading-none mb-1">{item.name}</h4>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">#{item.itemCode}</span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeItem(item.lineId); }} 
                        className={`w-10 h-10 transition-all rounded-full flex items-center justify-center ${selectedLineId === item.lineId ? 'bg-red-500 text-white shadow-lg animate-pulse' : 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white'}`}
                      >
                        <i className="fas fa-trash-alt text-sm"></i>
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-50">
                      <div className="flex flex-col">
                        <div className="flex items-center bg-slate-900 rounded-2xl p-1 shadow-md">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const step = item.unit === 'mtr' ? 0.25 : 1;
                              if (item.quantity <= step) {
                                removeItem(item.lineId);
                              } else {
                                setCart(prev => prev.map(i => i.lineId === item.lineId ? { ...i, quantity: Math.max(0, i.quantity - step) } : i));
                              }
                            }} 
                            className="w-10 h-10 flex items-center justify-center text-white font-black hover:bg-slate-800 rounded-xl"
                          >
                            <i className="fas fa-minus text-[10px]"></i>
                          </button>
                          <input 
                            type="number"
                            step={item.unit === 'mtr' ? '0.01' : '1'}
                            value={item.quantity}
                            onChange={(e) => { e.stopPropagation(); handleQuantityChange(item.lineId, e.target.value, item.unit); }}
                            className="w-16 bg-transparent text-center text-[14px] font-black text-white border-none focus:outline-none"
                          />
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const step = item.unit === 'mtr' ? 0.25 : 1;
                              setCart(prev => prev.map(i => i.lineId === item.lineId ? { ...i, quantity: i.quantity + step } : i));
                            }} 
                            className="w-10 h-10 flex items-center justify-center text-white font-black hover:bg-slate-800 rounded-xl"
                          >
                            <i className="fas fa-plus text-[10px]"></i>
                          </button>
                        </div>
                        <span className="text-[9px] font-black text-indigo-500 mt-2 ml-1 uppercase tracking-widest">Rate: ₹{item.price} / {item.unit}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-xl italic text-slate-900 block leading-none">₹{(item.price * item.quantity).toFixed(2)}</span>
                        <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Subtotal</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div className="h-10"></div>
            </div>
          </div>
        </div>
      </div>

      {pendingProduct && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl border-4 border-indigo-600">
             <div className="text-center mb-6">
                <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900">{pendingProduct.name}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase mt-2">Enter Billing Details</p>
             </div>
             <div className="space-y-4 mb-8">
                <div>
                   <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-1 block">Quantity ({pendingProduct.unit})</label>
                   <input 
                     ref={qtyModalInputRef} 
                     type="number" 
                     step={pendingProduct.unit === 'mtr' ? '0.01' : '1'} 
                     className="w-full text-center text-4xl font-black bg-slate-50 border-4 border-slate-900 rounded-3xl py-4 outline-none focus:border-indigo-600" 
                     value={entryQty} 
                     onChange={(e) => {
                       let v = e.target.value;
                       if (pendingProduct.unit === 'pcs') {
                         v = v.replace(/[^0-9]/g, '');
                       }
                       setEntryQty(v);
                     }} 
                     onKeyDown={(e) => e.key === 'Enter' && confirmAddToCart()} 
                   />
                </div>
                <div>
                   <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-1 block">Unit Price (₹)</label>
                   <input type="number" step="0.01" className="w-full text-center text-3xl font-black bg-slate-50 border-4 border-slate-900 rounded-3xl py-3 outline-none focus:border-indigo-600 text-indigo-600" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmAddToCart()} />
                </div>
             </div>
             <div className="flex space-x-3">
                <button onClick={() => setPendingProduct(null)} className="flex-1 bg-slate-100 py-4 rounded-2xl font-black text-[10px] uppercase">Cancel</button>
                <button onClick={confirmAddToCart} className="flex-[2] bg-indigo-600 py-4 rounded-2xl font-black text-[10px] uppercase text-white shadow-lg active:scale-95 transition-all">Add to Bill</button>
             </div>
          </div>
        </div>
      )}

      {currentReceipt && <Receipt invoice={currentReceipt} onClose={() => setCurrentReceipt(null)} />}

      <style>{`
        @keyframes slideInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-cartItem { animation: slideInUp 0.3s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default DevicePOS;