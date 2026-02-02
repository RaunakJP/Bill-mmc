
export interface Company {
  id: string;
  name?: string; 
  nameSecondary?: string; 
  headerTopLine?: string; 
  gstin: string;
  upiId: string;
  invoicePrefix: string;
  logoUrl?: string;
  logoScale?: number;
  addressLine1?: string;
  addressLine2?: string;
  contactNumber?: string;
  email?: string;
  termsLine1?: string;
  termsLine2?: string;
  thankYouEmojiStart?: string;
  thankYouEmojiEnd?: string;
  // Typography Settings
  companyNameSize?: number;
  secondaryNameSize?: number;
  invoiceNumberSize?: number;
  itemNameSize?: number;
  isBoldItemNames?: boolean;
}

export interface Product {
  id: string;
  companyId: string;
  itemCode: string;
  name: string;
  price: number; 
  category: string;
  stockQuantity: number;
  unit: string; 
  gstRate: number;
}

export interface PrinterConfig {
  paperWidth: '70mm' | '80mm' | '58mm';
  autoPrint: boolean;
  showQr: boolean;
  topMargin: number;
  connectionType: 'SYSTEM' | 'BLUETOOTH' | 'NETWORK';
  bluetoothDeviceId?: string;
  networkIp?: string;
  lastUsedTime?: string;
}

export interface User {
  id: string;
  username: string;
  password: string;
  role: 'admin' | 'device';
  deviceName?: string;
  lastActive?: string;
  isOnline?: boolean;
  printerSettings?: PrinterConfig;
}

export interface InvoiceItem {
  productId: string;
  itemCode: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  unit: string;
  gstRate: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  items: InvoiceItem[];
  totalAmount: number;
  gstAmount: number;
  baseAmount: number;
  deviceId: string;
  deviceName: string;
  companyId: string;
  companyName?: string;
  companyNameSecondary?: string;
  headerTopLine?: string;
  gstin: string;
  logoUrl?: string;
  logoScale?: number;
  upiId?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  paymentMethod: 'CASH' | 'UPI';
  addressLine1?: string;
  addressLine2?: string;
  contactNumber?: string;
  email?: string;
  termsLine1?: string;
  termsLine2?: string;
  thankYouEmojiStart?: string;
  thankYouEmojiEnd?: string;
  // Snapshot of styles
  companyNameSize?: number;
  secondaryNameSize?: number;
  invoiceNumberSize?: number;
  itemNameSize?: number;
  isBoldItemNames?: boolean;
}

export interface AppSettings {
  companies: Company[];
  activeCompanyId: string;
  gstRate: number; 
  lastSync?: string;
}

export type ViewState = 'login' | 'admin' | 'pos';

export interface SyncMessage {
  type: 'CATALOG_UPDATE' | 'SETTINGS_UPDATE' | 'USER_UPDATE' | 'INVOICE_NEW' | 'HEARTBEAT' | 'HANDSHAKE' | 'SYNC_REQUEST';
  payload: any;
  senderId: string;
}

export interface SyncStatus {
  hubId: string | null;
  isSyncing: boolean;
  connectedPeers: string[];
  lastSync?: string;
}
