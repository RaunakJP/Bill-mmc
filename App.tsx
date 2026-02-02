
import React, { useState, useEffect, useRef } from 'react';
import { ViewState, User, Product, Invoice, AppSettings, SyncMessage, Company } from './types';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import DevicePOS from './components/DevicePOS';

const STORAGE_KEYS = {
  USERS: 'bb_users_v2',
  PRODUCTS: 'bb_products_v2',
  INVOICES: 'bb_invoices_v2',
  SETTINGS: 'bb_settings_v2',
  CURRENT_USER: 'bb_current_user_v2'
};

const INITIAL_COMPANIES: Company[] = [
  {
    id: 'comp-mahavir',
    name: 'Mahavir Matching Centre',
    nameSecondary: 'महावीर मॅचिंग सेंटर',
    gstin: '27ASRPP7652G1Z2',
    upiId: 'gpay-12191012857@okbizaxis',
    invoicePrefix: 'MMC',
    addressLine1: 'Main Road, Tanga Chowk',
    addressLine2: 'Yavatmal, Maharashtra - 445001',
    contactNumber: '+91 9421486134',
    termsLine1: 'Goods once sold will not be taken back.',
    termsLine2: 'Subject to Local Jurisdiction.',
    thankYouEmojiStart: '🙏',
    thankYouEmojiEnd: '🙏',
    logoScale: 100
  },
  {
    id: 'comp-raunak',
    name: 'Raunak Enterprise',
    nameSecondary: 'रौनक एंटरप्राइजेस',
    gstin: '27ANXPP6071G1ZB',
    upiId: 'gpay-12191012857@okbizaxis',
    invoicePrefix: 'RE',
    addressLine1: 'Main Road, Tanga Chowk',
    addressLine2: 'Yavatmal, Maharashtra - 445001',
    contactNumber: '+91 9823380818',
    termsLine1: 'Goods once sold will not be taken back.',
    termsLine2: 'Subject to Local Jurisdiction.',
    thankYouEmojiStart: '✨',
    thankYouEmojiEnd: '✨',
    logoScale: 100
  }
];

const DEFAULT_PRODUCTS: Product[] = [
  // Mahavir Products (15)
  { id: 'p1', companyId: 'comp-mahavir', itemCode: 'TX-101', name: 'Terry Rubia', price: 120, category: 'Fabrics', stockQuantity: 1000, unit: 'pcs', gstRate: 5 },
  { id: 'p2', companyId: 'comp-mahavir', itemCode: 'TX-102', name: 'Astar (Cotton)', price: 50, category: 'Fabrics', stockQuantity: 1000, unit: 'pcs', gstRate: 5 },
  { id: 'p3', companyId: 'comp-mahavir', itemCode: 'TX-103', name: 'Poplin 2.25', price: 160, category: 'Fabrics', stockQuantity: 1000, unit: 'pcs', gstRate: 5 },
  { id: 'p4', companyId: 'comp-mahavir', itemCode: 'TX-104', name: 'Fall (Cotton)', price: 25, category: 'Fabrics', stockQuantity: 10000, unit: 'pcs', gstRate: 5 },
  { id: 'p5', companyId: 'comp-mahavir', itemCode: 'TX-105', name: 'Poplin 2.5', price: 180, category: 'Fabrics', stockQuantity: 1000, unit: 'pcs', gstRate: 5 },
  { id: 'p6', companyId: 'comp-mahavir', itemCode: 'TX-106', name: 'Pure Rubia', price: 200, category: 'Fabrics', stockQuantity: 1000, unit: 'pcs', gstRate: 5 },
  { id: 'p7', companyId: 'comp-mahavir', itemCode: 'TX-107', name: 'Pec', price: 45, category: 'Fabrics', stockQuantity: 1000, unit: 'pcs', gstRate: 5 },
  { id: 'p8', companyId: 'comp-mahavir', itemCode: 'TX-108', name: 'Poplin (Meters)', price: 120, category: 'Fabrics', stockQuantity: 500, unit: 'mtr', gstRate: 5 },
  { id: 'p9', companyId: 'comp-mahavir', itemCode: 'TX-109', name: 'Printed Pec', price: 140, category: 'Fabrics', stockQuantity: 1009, unit: 'pcs', gstRate: 5 },
  { id: 'p10', companyId: 'comp-mahavir', itemCode: 'TX-110', name: 'Devi Silk', price: 120, category: 'Fabrics', stockQuantity: 1000, unit: 'mtr', gstRate: 5 },
  { id: 'p11', companyId: 'comp-mahavir', itemCode: 'TX-111', name: 'B Silk', price: 200, category: 'Fabrics', stockQuantity: 1000, unit: 'mtr', gstRate: 5 },
  { id: 'p12', companyId: 'comp-mahavir', itemCode: 'TX-112', name: 'Terry Rubia (Meters)', price: 150, category: 'Fabrics', stockQuantity: 10000, unit: 'mtr', gstRate: 5 },
  { id: 'p13', companyId: 'comp-mahavir', itemCode: 'TX-113', name: 'Astar (Meters)', price: 60, category: 'Fabrics', stockQuantity: 10000, unit: 'mtr', gstRate: 5 },
  { id: 'p14', companyId: 'comp-mahavir', itemCode: 'TX-114', name: 'Rubai (Heavy)', price: 250, category: 'Fabrics', stockQuantity: 100, unit: 'mtr', gstRate: 5 },
  { id: 'p15', companyId: 'comp-mahavir', itemCode: 'TX-115', name: 'Nada (Drawstring)', price: 20, category: 'Accessories', stockQuantity: 10000, unit: 'pcs', gstRate: 5 },
  // Raunak Products (15)
  { id: 'r1', companyId: 'comp-raunak', itemCode: 'RE-01', name: 'GREEN NET', price: 100, category: 'Agri', stockQuantity: 9993, unit: 'mtr', gstRate: 5 },
  { id: 'r2', companyId: 'comp-raunak', itemCode: 'RE-02', name: 'TARPAULIN', price: 1000, category: 'Agri', stockQuantity: 10000, unit: 'pcs', gstRate: 18 },
  { id: 'r3', companyId: 'comp-raunak', itemCode: 'RE-03', name: 'PLASTIC SHEET', price: 60, category: 'Fabrics', stockQuantity: 9960, unit: 'mtr', gstRate: 18 },
  { id: 'r4', companyId: 'comp-raunak', itemCode: 'RE-04', name: 'READY GREEN NET SIZES', price: 550, category: 'Agri', stockQuantity: 10000, unit: 'pcs', gstRate: 5 },
  { id: 'r5', companyId: 'comp-raunak', itemCode: 'RE-05', name: 'PLASTI PEC', price: 50, category: 'Fabrics', stockQuantity: 10000, unit: 'pcs', gstRate: 18 },
  { id: 'r6', companyId: 'comp-raunak', itemCode: 'RE-06', name: 'NEWAR', price: 5, category: 'Accessories', stockQuantity: 1000, unit: 'mtr', gstRate: 5 },
  { id: 'r7', companyId: 'comp-raunak', itemCode: 'RE-07', name: 'TARPAULIN KG', price: 150, category: 'Agri', stockQuantity: 5000, unit: 'kg', gstRate: 18 },
  { id: 'r8', companyId: 'comp-raunak', itemCode: 'RE-08', name: 'ILET', price: 20, category: 'Accessories', stockQuantity: 10000, unit: 'pcs', gstRate: 18 },
  { id: 'r9', companyId: 'comp-raunak', itemCode: 'RE-09', name: 'NYLON ROPE (HEAVY)', price: 85, category: 'Accessories', stockQuantity: 2000, unit: 'kg', gstRate: 12 },
  { id: 'r10', companyId: 'comp-raunak', itemCode: 'RE-10', name: 'PVC COATED WIRE', price: 12, category: 'Agri', stockQuantity: 5000, unit: 'mtr', gstRate: 18 },
  { id: 'r11', companyId: 'comp-raunak', itemCode: 'RE-11', name: 'MULCHING FILM 30MIC', price: 1800, category: 'Agri', stockQuantity: 100, unit: 'pcs', gstRate: 12 },
  { id: 'r12', companyId: 'comp-raunak', itemCode: 'RE-12', name: 'SHADE NET (90%)', price: 75, category: 'Agri', stockQuantity: 1200, unit: 'mtr', gstRate: 5 },
  { id: 'r13', companyId: 'comp-raunak', itemCode: 'RE-13', name: 'BUCKET PLASTIC', price: 120, category: 'Utility', stockQuantity: 500, unit: 'pcs', gstRate: 18 },
  { id: 'r14', companyId: 'comp-raunak', itemCode: 'RE-14', name: 'AGRI PIPE (2 INCH)', price: 450, category: 'Agri', stockQuantity: 200, unit: 'pcs', gstRate: 12 },
  { id: 'r15', companyId: 'comp-raunak', itemCode: 'RE-15', name: 'GARDEN HOSE 50M', price: 1100, category: 'Utility', stockQuantity: 50, unit: 'pcs', gstRate: 18 }
];

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewState>('login');
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    companies: INITIAL_COMPANIES,
    activeCompanyId: INITIAL_COMPANIES[0].id,
    gstRate: 0.05,
    lastSync: new Date().toISOString()
  });

  const syncChannel = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    syncChannel.current = new BroadcastChannel('mahavir_sync_engine_v30_final');
    syncChannel.current.onmessage = (event: MessageEvent<SyncMessage>) => {
      const { type, payload, senderId } = event.data;
      if (senderId === currentUser?.id) return;
      switch (type) {
        case 'CATALOG_UPDATE': setProducts(payload); break;
        case 'SETTINGS_UPDATE': setSettings(payload); break;
        case 'USER_UPDATE': setUsers(payload); break;
        case 'INVOICE_NEW': setInvoices(prev => [payload, ...prev]); break;
      }
    };
    return () => syncChannel.current?.close();
  }, [currentUser]);

  useEffect(() => {
    const storedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
    const storedProducts = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    const storedInvoices = localStorage.getItem(STORAGE_KEYS.INVOICES);
    const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    const storedCurrentUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);

    if (storedUsers) {
      setUsers(JSON.parse(storedUsers));
    } else {
      const admin: User = { id: 'admin-1', username: 'MMC', password: 'mmn123', role: 'admin' };
      setUsers([admin]);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([admin]));
    }

    if (storedProducts) {
      setProducts(JSON.parse(storedProducts));
    } else {
      setProducts(DEFAULT_PRODUCTS);
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(DEFAULT_PRODUCTS));
    }

    if (storedInvoices) setInvoices(JSON.parse(storedInvoices));
    
    if (storedSettings) {
      setSettings(JSON.parse(storedSettings));
    } else {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    }

    if (storedCurrentUser) {
      const user = JSON.parse(storedCurrentUser);
      setCurrentUser(user);
      setView(user.role === 'admin' ? 'admin' : 'pos');
    }
  }, []);

  const broadcast = (type: SyncMessage['type'], payload: any) => {
    syncChannel.current?.postMessage({
      type,
      payload,
      senderId: currentUser?.id || 'system'
    });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    setView('login');
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    setView(user.role === 'admin' ? 'admin' : 'pos');
  };

  const updateProducts = (newProducts: Product[]) => {
    setProducts(newProducts);
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(newProducts));
    broadcast('CATALOG_UPDATE', newProducts);
  };

  const updateInvoices = (newInvoices: Invoice[]) => {
    setInvoices(newInvoices);
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(newInvoices));
  };

  const updateUsers = (newUsers: User[]) => {
    setUsers(newUsers);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(newUsers));
    broadcast('USER_UPDATE', newUsers);
  };

  const updateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
    broadcast('SETTINGS_UPDATE', newSettings);
  };

  const addInvoice = (invoice: Invoice) => {
    const updatedProducts = products.map(p => {
      const soldItem = invoice.items.find(item => item.productId === p.id);
      if (soldItem) return { ...p, stockQuantity: Number((p.stockQuantity - soldItem.quantity).toFixed(3)) };
      return p;
    });

    setProducts(updatedProducts);
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(updatedProducts));
    broadcast('CATALOG_UPDATE', updatedProducts);

    const newInvoices = [invoice, ...invoices];
    setInvoices(newInvoices);
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(newInvoices));
    broadcast('INVOICE_NEW', invoice);
  };

  return (
    <div className="min-h-screen">
      {view === 'login' && <Login users={users} onLogin={handleLogin} />}
      {view === 'admin' && currentUser?.role === 'admin' && (
        <AdminDashboard
          user={currentUser}
          users={users}
          products={products}
          invoices={invoices}
          settings={settings}
          onLogout={handleLogout}
          onUpdateUsers={updateUsers}
          onUpdateProducts={updateProducts}
          onUpdateInvoices={updateInvoices}
          onUpdateSettings={updateSettings}
          onSaveInvoice={addInvoice}
        />
      )}
      {view === 'pos' && currentUser && (
        <DevicePOS
          user={currentUser}
          products={products}
          settings={settings}
          onLogout={handleLogout}
          onSaveInvoice={addInvoice}
          onUpdateSettings={updateSettings}
        />
      )}
    </div>
  );
};

export default App;
