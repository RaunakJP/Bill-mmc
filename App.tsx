
import React, { useState, useEffect, useRef } from 'react';
import { ViewState, User, Product, Invoice, AppSettings, SyncMessage, Company, SyncStatus } from './types';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import DevicePOS from './components/DevicePOS';
import { Peer } from 'peerjs';

const STORAGE_KEYS = {
  USERS: 'bb_users_v2',
  PRODUCTS: 'bb_products_v2',
  INVOICES: 'bb_invoices_v2',
  SETTINGS: 'bb_settings_v2',
  CURRENT_USER: 'bb_current_user_v2',
  LAST_HUB: 'bb_last_hub_id'
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
  }
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

  // Networking State
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    hubId: null,
    connectedPeers: [],
    isSyncing: false
  });

  const syncChannel = useRef<BroadcastChannel | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Record<string, any>>({});

  useEffect(() => {
    // Local Tab Sync
    syncChannel.current = new BroadcastChannel('mahavir_global_sync_v2');
    syncChannel.current.onmessage = (event: MessageEvent<SyncMessage>) => {
      handleIncomingSync(event.data, false);
    };

    return () => {
      syncChannel.current?.close();
      peerRef.current?.destroy();
    };
  }, [currentUser]);

  // Peer-to-Peer Discovery
  useEffect(() => {
    if (!currentUser) return;

    const isHub = currentUser.role === 'admin';
    const myId = isHub 
      ? `MMC-HUB-${currentUser.username.replace(/\s+/g, '-')}` 
      : `MMC-TERM-${Math.random().toString(36).substr(2, 5)}`;
    
    setSyncStatus(prev => ({ ...prev, hubId: isHub ? myId : null }));

    const peer = new Peer(myId, {
      debug: 1,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    });

    peer.on('connection', (conn) => {
      setupConnection(conn);
    });

    peerRef.current = peer;

    if (!isHub) {
      const lastHub = localStorage.getItem(STORAGE_KEYS.LAST_HUB);
      if (lastHub) connectToHub(lastHub);
    }

    return () => {
      peer.destroy();
      connectionsRef.current = {};
    };
  }, [currentUser]);

  const setupConnection = (conn: any) => {
    conn.on('open', () => {
      connectionsRef.current[conn.peer] = conn;
      setSyncStatus(prev => ({ 
        ...prev, 
        connectedPeers: Object.keys(connectionsRef.current) 
      }));
      
      // Clients request initial state from Hub
      if (currentUser?.role === 'device') {
        conn.send({ 
          type: 'SYNC_REQUEST', 
          senderId: currentUser.id 
        });
      }
    });

    conn.on('data', (data: any) => {
      handleIncomingSync(data as SyncMessage, true);
    });
    
    conn.on('close', () => {
      delete connectionsRef.current[conn.peer];
      setSyncStatus(prev => ({ 
        ...prev, 
        connectedPeers: Object.keys(connectionsRef.current) 
      }));
    });
  };

  const connectToHub = (id: string) => {
    if (!peerRef.current || connectionsRef.current[id]) return;
    localStorage.setItem(STORAGE_KEYS.LAST_HUB, id);
    const conn = peerRef.current.connect(id);
    setupConnection(conn);
  };

  const handleIncomingSync = (message: SyncMessage, fromNetwork: boolean) => {
    const { type, payload, senderId } = message;
    if (senderId === currentUser?.id) return;

    setSyncStatus(prev => ({ ...prev, isSyncing: true }));
    
    switch (type) {
      case 'SYNC_REQUEST':
        if (currentUser?.role === 'admin') {
          broadcast('HANDSHAKE', { products, settings, invoices });
        }
        break;
      case 'HANDSHAKE':
        if (payload.products) setProducts(payload.products);
        if (payload.settings) setSettings(payload.settings);
        if (payload.invoices) setInvoices(payload.invoices);
        break;
      case 'CATALOG_UPDATE':
        setProducts(payload);
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(payload));
        break;
      case 'SETTINGS_UPDATE':
        setSettings(payload);
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(payload));
        break;
      case 'INVOICE_NEW':
        setInvoices(prev => {
          if (prev.some(i => i.id === payload.id)) return prev;
          const updated = [payload, ...prev];
          localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(updated));
          return updated;
        });
        break;
    }

    if (fromNetwork) syncChannel.current?.postMessage(message);
    setTimeout(() => setSyncStatus(prev => ({ ...prev, isSyncing: false })), 800);
  };

  const broadcast = (type: any, payload: any) => {
    const message: SyncMessage = {
      type,
      payload,
      senderId: currentUser?.id || 'system'
    };

    syncChannel.current?.postMessage(message);
    Object.values(connectionsRef.current).forEach((conn: any) => {
      if (conn.open) conn.send(message);
    });
  };

  useEffect(() => {
    const storedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
    const storedProducts = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    const storedInvoices = localStorage.getItem(STORAGE_KEYS.INVOICES);
    const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    const storedCurrentUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);

    if (storedUsers) setUsers(JSON.parse(storedUsers));
    else {
      const admin: User = { id: 'admin-1', username: 'MMC ADMIN', password: '123', role: 'admin' };
      setUsers([admin]);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([admin]));
    }

    if (storedProducts) setProducts(JSON.parse(storedProducts));
    if (storedInvoices) setInvoices(JSON.parse(storedInvoices));
    if (storedSettings) setSettings(JSON.parse(storedSettings));

    if (storedCurrentUser) {
      const user = JSON.parse(storedCurrentUser);
      setCurrentUser(user);
      setView(user.role === 'admin' ? 'admin' : 'pos');
    }
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    setView(user.role === 'admin' ? 'admin' : 'pos');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    setView('login');
    peerRef.current?.destroy();
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
          onUpdateUsers={(u) => { setUsers(u); broadcast('USER_UPDATE', u); }}
          onUpdateProducts={(p) => { setProducts(p); broadcast('CATALOG_UPDATE', p); }}
          onUpdateInvoices={setInvoices}
          onUpdateSettings={(s) => { setSettings(s); broadcast('SETTINGS_UPDATE', s); }}
          onSaveInvoice={addInvoice}
          syncStatus={syncStatus}
        />
      )}
      {view === 'pos' && currentUser && (
        <DevicePOS
          user={currentUser}
          products={products}
          settings={settings}
          onLogout={handleLogout}
          onSaveInvoice={addInvoice}
          onUpdateSettings={(s) => { setSettings(s); broadcast('SETTINGS_UPDATE', s); }}
          syncStatus={syncStatus}
          onConnectHub={connectToHub}
        />
      )}
    </div>
  );
};

export default App;
