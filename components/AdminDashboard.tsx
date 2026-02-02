
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, Product, Invoice, AppSettings, Company, PrinterConfig } from '../types';
import Receipt from './Receipt';
import DevicePOS from './DevicePOS';

// Dynamic imports for export libraries
const loadExcelLib = () => import('https://esm.sh/xlsx');
const loadPDFLib = () => import('https://esm.sh/jspdf');
const loadPDFAutoTable = () => import('https://esm.sh/jspdf-autotable');

interface AdminProps {
  user: User;
  users: User[];
  products: Product[];
  invoices: Invoice[];
  settings: AppSettings;
  onLogout: () => void;
  onUpdateUsers: (users: User[]) => void;
  onUpdateProducts: (products: Product[]) => void;
  onUpdateInvoices: (invoices: Invoice[]) => void;
  onUpdateSettings: (settings: AppSettings) => void;
  onSaveInvoice: (invoice: Invoice) => void;
}

const GST_RATES = [0, 5, 12, 18, 28];

const AdminDashboard: React.FC<AdminProps> = ({
  user, users, products, invoices, settings, onLogout, onUpdateUsers, onUpdateProducts, onUpdateInvoices, onUpdateSettings, onSaveInvoice
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'devices' | 'settings' | 'invoices' | 'pos' | 'system'>('overview');
  const [selectedReceipt, setSelectedReceipt] = useState<Invoice | null>(null);
  const [localSettings, setLocalSettings] = useState<AppSettings>({ ...settings });
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  const [exportCompanyId, setExportCompanyId] = useState<string>(settings.activeCompanyId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalSettings({ ...settings });
    setExportCompanyId(settings.activeCompanyId);
  }, [settings]);

  const activeCompany = useMemo(() => {
    return settings.companies.find(c => c.id === settings.activeCompanyId) || settings.companies[0];
  }, [settings.companies, settings.activeCompanyId]);

  const exportTargetCompany = useMemo(() => {
    return settings.companies.find(c => c.id === exportCompanyId) || activeCompany;
  }, [settings.companies, exportCompanyId, activeCompany]);

  const companyProducts = useMemo(() => {
    return products.filter(p => p.companyId === settings.activeCompanyId);
  }, [products, settings.activeCompanyId]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => inv.companyId === exportCompanyId);
  }, [invoices, exportCompanyId]);

  const taxSummary = useMemo(() => {
    const summary: Record<number, { taxable: number; cgst: number; sgst: number }> = {
      0: { taxable: 0, cgst: 0, sgst: 0 },
      5: { taxable: 0, cgst: 0, sgst: 0 },
      12: { taxable: 0, cgst: 0, sgst: 0 },
      18: { taxable: 0, cgst: 0, sgst: 0 },
      28: { taxable: 0, cgst: 0, sgst: 0 }
    };
    filteredInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const rate = item.gstRate || 0;
        const total = item.price * item.quantity;
        const gstTotal = (total * rate) / (100 + rate);
        const taxable = total - gstTotal;
        if (!summary[rate]) summary[rate] = { taxable: 0, cgst: 0, sgst: 0 };
        summary[rate].taxable += taxable;
        summary[rate].cgst += gstTotal / 2;
        summary[rate].sgst += gstTotal / 2;
      });
    });
    return summary;
  }, [filteredInvoices]);

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const XLSX = await import('https://esm.sh/xlsx');
      const detailData = filteredInvoices.map(inv => {
        const row: any = {
          'Invoice Number': inv.invoiceNumber,
          'Date': new Date(inv.date).toLocaleDateString(),
          'Time': new Date(inv.date).toLocaleTimeString(),
          'Terminal': inv.deviceName,
          'Customer': inv.customerName || 'Cash Sale',
          'Payment Mode': inv.paymentMethod,
          'Total Taxable': Number(inv.baseAmount.toFixed(2)),
          'Total GST': Number(inv.gstAmount.toFixed(2)),
          'Grand Total': Number(inv.totalAmount.toFixed(2))
        };
        GST_RATES.forEach(rate => {
          if (rate === 0) return;
          const slabItems = inv.items.filter(i => i.gstRate === rate);
          const slabGst = slabItems.reduce((sum, i) => sum + ((i.price * i.quantity) * rate / (100 + rate)), 0);
          row[`GST ${rate}% (Bifurcated)`] = Number(slabGst.toFixed(2));
        });
        return row;
      });
      const summaryData = (Object.entries(taxSummary) as [string, any][])
        .filter(([rate, data]) => Number(rate) > 0 || data.taxable > 0)
        .map(([rate, data]) => ({
          'GST Slab': `${rate}%`,
          'Taxable Value': Number(data.taxable.toFixed(2)),
          'CGST': Number(data.cgst.toFixed(2)),
          'SGST': Number(data.sgst.toFixed(2)),
          'Total GST': Number((data.cgst + data.sgst).toFixed(2)),
          'Gross Total': Number((data.taxable + data.cgst + data.sgst).toFixed(2))
        }));
      const wb = XLSX.utils.book_new();
      const wsDetails = XLSX.utils.json_to_sheet(detailData);
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsDetails, "Transaction Details");
      XLSX.utils.book_append_sheet(wb, wsSummary, "GST Bifurcation");
      XLSX.writeFile(wb, `${exportTargetCompany.name}_Detailed_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      alert("Excel export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const { jsPDF } = await loadPDFLib();
      await loadPDFAutoTable();
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text(`${exportTargetCompany.name} Ledger`, 14, 22);
      doc.setFontSize(10);
      doc.text(`GSTIN: ${exportTargetCompany.gstin}`, 14, 30);
      doc.text(`Report Date: ${new Date().toLocaleString()}`, 14, 36);
      const tableData = filteredInvoices.map(inv => [
        inv.invoiceNumber,
        new Date(inv.date).toLocaleDateString(),
        inv.deviceName,
        inv.customerName || 'Cash Sale',
        inv.paymentMethod,
        inv.totalAmount.toFixed(2)
      ]);
      (doc as any).autoTable({
        startY: 45,
        head: [['Invoice #', 'Date', 'Terminal', 'Customer', 'Method', 'Amount (INR)']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] }
      });
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.text("GST Bifurcation Summary", 14, finalY);
      const taxTableData = (Object.entries(taxSummary) as [string, any][])
        .filter(([rate, data]) => Number(rate) > 0 || data.taxable > 0)
        .map(([rate, data]) => [
          `${rate}% Slab`,
          data.taxable.toFixed(2),
          data.cgst.toFixed(2),
          data.sgst.toFixed(2),
          (data.cgst + data.sgst).toFixed(2),
          (data.taxable + data.cgst + data.sgst).toFixed(2)
        ]);
      (doc as any).autoTable({
        startY: finalY + 5,
        head: [['GST Slab', 'Taxable', 'CGST', 'SGST', 'Total GST', 'Total']],
        body: taxTableData,
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85] }
      });
      doc.save(`${exportTargetCompany.name}_Ledger_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      alert("PDF export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleUpdateActiveCompany = (id: string) => {
    const updated = { ...localSettings, activeCompanyId: id };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  };

  const handleExportData = () => {
    const data = { products, settings, timestamp: new Date().toISOString(), version: "3.0" };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bharatbill_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.products && data.settings) {
          if (confirm("This will overwrite all current inventory and company settings. Proceed?")) {
            onUpdateProducts(data.products);
            onUpdateSettings(data.settings);
            alert("Master Import Successful!");
            window.location.reload();
          }
        }
      } catch (err) { alert("Failed to parse backup."); }
    };
    reader.readAsText(file);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingCompany) {
      const reader = new FileReader();
      reader.onloadend = () => setEditingCompany({ ...editingCompany, logoUrl: reader.result as string, logoScale: editingCompany.logoScale || 100 });
      reader.readAsDataURL(file);
    }
  };

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;
    let updatedCompanies = [...localSettings.companies];
    const index = updatedCompanies.findIndex(c => c.id === editingCompany.id);
    if (index >= 0) { updatedCompanies[index] = editingCompany; }
    else { updatedCompanies.push(editingCompany); }
    const updated = { ...localSettings, companies: updatedCompanies };
    setLocalSettings(updated);
    onUpdateSettings(updated);
    setShowCompanyModal(false);
    setEditingCompany(null);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    let updatedProducts = [...products];
    const index = updatedProducts.findIndex(p => p.id === editingProduct.id);
    if (index >= 0) { updatedProducts[index] = editingProduct; }
    else { updatedProducts.push(editingProduct); }
    onUpdateProducts(updatedProducts);
    setShowProductModal(false);
    setEditingProduct(null);
  };

  const handleDeleteCompany = (id: string) => {
    if (localSettings.companies.length <= 1) { alert("At least one company must exist."); return; }
    if (confirm("Delete this company?")) {
      const updatedCompanies = localSettings.companies.filter(c => c.id !== id);
      let newActiveId = localSettings.activeCompanyId;
      if (id === localSettings.activeCompanyId) { newActiveId = updatedCompanies[0].id; }
      const updated = { ...localSettings, companies: updatedCompanies, activeCompanyId: newActiveId };
      setLocalSettings(updated);
      onUpdateSettings(updated);
      onUpdateProducts(products.filter(p => p.companyId !== id));
    }
  };

  if (activeTab === 'pos') {
    return (
      <div className="flex-1 flex flex-col h-screen no-print">
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <button onClick={() => setActiveTab('overview')} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">
            <i className="fas fa-chevron-left mr-2"></i> Exit POS Hub
          </button>
          <div className="flex flex-col items-center">
            <h2 className="font-black text-[11px] uppercase tracking-[0.2em] italic">Admin Master Terminal</h2>
            <span className="text-[7px] font-black text-indigo-400 uppercase">Secure Elevated Access</span>
          </div>
          <div className="w-24"></div>
        </div>
        <div className="flex-1 overflow-hidden">
          <DevicePOS user={user} products={products} settings={settings} onLogout={onLogout} onSaveInvoice={onSaveInvoice} onUpdateSettings={onUpdateSettings} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row no-print font-sans select-none">
      <div className="w-full md:w-72 bg-[#0F172A] text-white flex flex-col z-20 shadow-2xl">
        <div className="p-10 border-b border-slate-800 text-center relative overflow-hidden">
          <div className="w-14 h-14 bg-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-600/30">
            <i className="fas fa-crown text-xl"></i>
          </div>
          <h2 className="text-2xl font-black tracking-tighter uppercase italic leading-none">HQ Command</h2>
          <span className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.4em] block mt-2">Enterprise Suite</span>
        </div>
        
        <nav className="flex-1 p-6 space-y-2">
          {[
            { id: 'overview', icon: 'chart-pie', label: 'Metrics' },
            { id: 'pos', icon: 'bolt', label: 'Make a Bill' },
            { id: 'invoices', icon: 'history', label: 'Backup & Export' },
            { id: 'products', icon: 'boxes', label: 'Inventory' },
            { id: 'devices', icon: 'tablet-alt', label: 'Devices' },
            { id: 'settings', icon: 'sliders-h', label: 'Companies' },
            { id: 'system', icon: 'shield-alt', label: 'System' }
          ].map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id as any)} 
              className={`w-full text-left px-6 py-4 rounded-[1.5rem] flex items-center transition-all group ${activeTab === item.id ? 'bg-indigo-600 shadow-xl shadow-indigo-600/20 text-white' : 'hover:bg-slate-800/50 text-slate-400 hover:text-white'}`}>
              <i className={`fas fa-${item.icon} mr-4 text-xs group-hover:scale-110 transition-transform`}></i>
              <span className="font-black text-[11px] uppercase tracking-widest leading-tight">{item.label}</span>
            </button>
          ))}
        </nav>
        
        <div className="p-8 border-t border-slate-800">
           <button onClick={onLogout} className="w-full text-left px-6 py-4 rounded-2xl text-red-400 hover:bg-red-500/10 font-black text-[10px] uppercase tracking-widest transition-all">
             <i className="fas fa-power-off mr-4"></i> End Session
           </button>
        </div>
      </div>

      <div className="flex-1 p-8 md:p-14 lg:p-16 overflow-y-auto bg-[#F8FAFC]">
        <header className="mb-12 flex flex-col sm:flex-row justify-between sm:items-end gap-6">
          <div>
             <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
               {activeTab === 'invoices' ? 'Backup & Export' : activeTab}
             </h1>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-3">BharatBill Enterprise Management</p>
          </div>
          {activeTab === 'invoices' && (
            <div className="flex space-x-4">
              <div className="flex flex-col space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Filter by Hub</label>
                <select className="bg-white border-2 border-slate-900 rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none focus:border-indigo-600 transition-all" value={exportCompanyId} onChange={(e) => setExportCompanyId(e.target.value)}>
                  {settings.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex items-end space-x-2">
                <button disabled={isExporting} onClick={handleExportExcel} className="bg-green-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2 transition-all">
                  {isExporting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-file-excel"></i>}
                  <span>Excel</span>
                </button>
                <button disabled={isExporting} onClick={handleExportPDF} className="bg-red-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-red-700 disabled:opacity-50 flex items-center space-x-2 transition-all">
                  {isExporting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-file-pdf"></i>}
                  <span>PDF</span>
                </button>
              </div>
            </div>
          )}
        </header>

        {activeTab === 'overview' && (
           <div className="space-y-12 animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white border-4 border-slate-900 p-10 rounded-[3rem] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 relative z-10">Total Revenue</p>
                   <p className="text-4xl font-black text-slate-900 relative z-10 tracking-tighter italic">₹{invoices.reduce((a,b)=>a+b.totalAmount,0).toLocaleString()}</p>
                </div>
                <div className="bg-white border-4 border-slate-900 p-10 rounded-[3rem] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 relative z-10">Total Orders</p>
                   <p className="text-4xl font-black text-slate-900 relative z-10 tracking-tighter italic">{invoices.length}</p>
                </div>
                <div className="bg-white border-4 border-slate-900 p-10 rounded-[3rem] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 relative z-10">Sync Nodes</p>
                   <p className="text-4xl font-black text-slate-900 relative z-10 tracking-tighter italic">{users.length}</p>
                </div>
              </div>

              <div className="bg-white border-4 border-slate-900 rounded-[3.5rem] p-10 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex justify-between items-center mb-8 border-b-2 border-slate-50 pb-6">
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter">Live Order Feed</h3>
                  <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full uppercase">Real-time Cloud updates</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b-4 border-slate-900 font-black uppercase tracking-[0.2em] text-[10px]">
                        <th className="pb-6">Invoice #</th>
                        <th className="pb-6">Source Terminal</th>
                        <th className="pb-6">Company</th>
                        <th className="pb-6 text-right">Settlement Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoices.length === 0 ? (
                        <tr><td colSpan={4} className="py-20 text-center opacity-30 font-black uppercase text-xs tracking-widest">No transactions logged yet</td></tr>
                      ) : (
                        invoices.slice(0,12).map(inv => (
                          <tr key={inv.id} className="cursor-pointer hover:bg-slate-50 transition-all hover:translate-x-1" onClick={()=>setSelectedReceipt(inv)}>
                             <td className="py-6 font-black text-indigo-600 text-base">#{inv.invoiceNumber}</td>
                             <td className="py-6 font-black uppercase text-slate-500 italic">{inv.deviceName}</td>
                             <td className="py-6 font-bold text-slate-400 text-[10px] uppercase">{inv.companyName || inv.companyNameSecondary || 'Unnamed Hub'}</td>
                             <td className="py-6 text-right font-black text-slate-900 text-lg">₹{inv.totalAmount.toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
           </div>
        )}

        {activeTab === 'invoices' && (
           <div className="animate-fadeIn space-y-10">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                 {(Object.entries(taxSummary) as [string, any][]).filter(([rate, data]) => Number(rate) > 0 || data.taxable > 0).map(([rate, data]) => (
                   <div key={rate} className="bg-white border-2 border-slate-900 p-6 rounded-[2rem] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">GST {rate}% Slab</span>
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-black text-slate-900 italic">₹{(data.cgst + data.sgst).toLocaleString()}</p>
                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tight">Taxable: ₹{data.taxable.toLocaleString()}</p>
                      </div>
                   </div>
                 ))}
                 <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-[4px_4px_0px_0px_rgba(79,70,229,1)]">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Period GST</span>
                    <p className="text-sm font-black italic mt-2">₹{(Object.values(taxSummary) as any[]).reduce((s, d) => s + (d.cgst + d.sgst), 0).toLocaleString()}</p>
                 </div>
              </div>
              <div className="bg-white border-4 border-slate-900 rounded-[3.5rem] p-10 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex justify-between items-center mb-8 border-b-2 border-slate-50 pb-6">
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter">Transaction Ledger: {exportTargetCompany.name}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b-4 border-slate-900 font-black uppercase tracking-[0.2em] text-[10px]">
                        <th className="pb-6">Invoice #</th>
                        <th className="pb-6">Date</th>
                        <th className="pb-6">Terminal</th>
                        <th className="pb-6">Customer</th>
                        <th className="pb-6">Method</th>
                        <th className="pb-6 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredInvoices.length === 0 ? (
                        <tr><td colSpan={6} className="py-24 text-center opacity-30 font-black uppercase text-xs tracking-widest">No invoices found</td></tr>
                      ) : (
                        filteredInvoices.map(inv => (
                          <tr key={inv.id} className="cursor-pointer hover:bg-slate-50 transition-all group" onClick={()=>setSelectedReceipt(inv)}>
                             <td className="py-6 font-black text-indigo-600">#{inv.invoiceNumber}</td>
                             <td className="py-6 font-bold text-slate-500">{new Date(inv.date).toLocaleDateString()}</td>
                             <td className="py-6 font-black uppercase text-slate-400 text-[10px]">{inv.deviceName}</td>
                             <td className="py-6 font-bold text-slate-600 uppercase">{inv.customerName || 'Cash Sale'}</td>
                             <td className="py-6">
                               <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${inv.paymentMethod === 'UPI' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-600'}`}>
                                 {inv.paymentMethod}
                               </span>
                             </td>
                             <td className="py-6 text-right font-black text-slate-900 text-lg">₹{inv.totalAmount.toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
           </div>
        )}

        {activeTab === 'products' && (
           <div className="space-y-10 animate-fadeIn max-w-6xl">
              <div className="flex justify-between items-center bg-white border-4 border-slate-900 p-8 rounded-[3rem] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-4">
                 <div>
                   <h2 className="text-3xl font-black uppercase italic tracking-tighter">{activeCompany.name || activeCompany.nameSecondary || 'Catalog Hub'} Catalog</h2>
                 </div>
                 <button onClick={() => { setEditingProduct({ id: `p-${Date.now()}`, companyId: settings.activeCompanyId, itemCode: '', name: '', price: 0, category: 'General', stockQuantity: 0, unit: 'pcs', gstRate: 5 }); setShowProductModal(true); }} className="bg-indigo-600 text-white px-8 py-4 rounded-[2rem] font-black text-[10px] uppercase shadow-xl shadow-indigo-600/20 hover:scale-105 transition-all">Add Product</button>
              </div>
              <div className="bg-white border-4 border-slate-900 rounded-[3.5rem] overflow-hidden shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] p-8">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-100">
                    {companyProducts.map((p, index) => (
                      <tr key={p.id} className="group hover:bg-slate-50 transition-all duration-300">
                        <td className="py-8 pr-8 w-12"><span className="text-blue-600 font-black text-xl italic">{index + 1}</span></td>
                        <td className="py-8 pr-8">
                           <h4 className="font-black text-xl uppercase text-slate-900 tracking-tight leading-none">{p.name}</h4>
                           <p className="text-[9px] font-black text-slate-400 mt-2 uppercase tracking-widest">{p.itemCode}</p>
                        </td>
                        <td className="py-8 pr-8 text-right"><span className="font-black text-2xl text-slate-900 italic tracking-tighter">₹{p.price}</span></td>
                        <td className="py-8 pr-8 text-center"><span className="bg-blue-100 text-blue-700 font-black text-[11px] px-5 py-2 rounded-full uppercase">{p.gstRate}%</span></td>
                        <td className="py-8 pr-8 text-right"><span className="font-black text-xl text-slate-400 tracking-tighter">{p.stockQuantity}</span></td>
                        <td className="py-8 pl-4 text-right">
                           <div className="flex items-center justify-end space-x-4">
                              <button onClick={() => { setEditingProduct(p); setShowProductModal(true); }} className="text-slate-200 hover:text-blue-600 transition-colors"><i className="fas fa-edit text-lg"></i></button>
                              <button onClick={() => { if(confirm('Remove?')) onUpdateProducts(products.filter(item => item.id !== p.id)); }} className="text-slate-200 hover:text-red-500 transition-colors"><i className="fas fa-trash-alt text-lg"></i></button>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
           </div>
        )}

        {activeTab === 'settings' && (
          <div className="animate-fadeIn space-y-8">
            <div className="flex justify-between items-center bg-white border-4 border-slate-900 p-8 rounded-[3rem] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-4">
               <h2 className="text-3xl font-black uppercase italic tracking-tighter">Hub Management</h2>
               <button onClick={() => { setEditingCompany({ id: `comp-${Date.now()}`, name: '', nameSecondary: '', gstin: '', upiId: '', invoicePrefix: '', logoScale: 100 }); setShowCompanyModal(true); }} className="bg-indigo-600 text-white px-8 py-4 rounded-[2rem] font-black text-[10px] uppercase shadow-xl shadow-indigo-600/20 hover:scale-105 transition-all">Add Company</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {localSettings.companies.map(comp => (
                <div key={comp.id} className={`bg-white border-4 rounded-[3rem] p-8 transition-all shadow-xl group relative overflow-hidden ${localSettings.activeCompanyId === comp.id ? 'border-indigo-600 shadow-indigo-600/10' : 'border-slate-900 shadow-black/5'}`}>
                  {localSettings.activeCompanyId === comp.id && <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[8px] font-black uppercase px-6 py-2 rounded-bl-3xl">Active</div>}
                  <div className="mb-6">
                    <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 line-clamp-1">{comp.name || comp.nameSecondary || 'Unnamed Hub'}</h3>
                    <p className="text-[9px] font-black text-slate-400 uppercase mt-1 tracking-widest">{comp.gstin}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {localSettings.activeCompanyId !== comp.id && <button onClick={() => handleUpdateActiveCompany(comp.id)} className="flex-1 bg-slate-900 text-white py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all">Select</button>}
                    <button onClick={() => { setEditingCompany(comp); setShowCompanyModal(true); }} className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 transition-all"><i className="fas fa-edit text-xs"></i></button>
                    <button onClick={() => handleDeleteCompany(comp.id)} className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all"><i className="fas fa-trash-alt text-xs"></i></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'system' && (
           <div className="animate-fadeIn space-y-12 max-w-3xl">
              <div className="bg-white border-4 border-slate-900 p-12 rounded-[4rem] shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
                 <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-10">System Engine</h2>
                 <div className="grid grid-cols-1 gap-6">
                    <button onClick={handleExportData} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-indigo-600 transition-all">Download Inventory Backup</button>
                    <input type="file" ref={importFileRef} className="hidden" accept=".json" onChange={handleImportData} />
                    <button onClick={() => importFileRef.current?.click()} className="w-full bg-white border-4 border-slate-900 text-slate-900 py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:border-indigo-600 hover:text-indigo-600 transition-all">Restore From Backup</button>
                    <button onClick={() => { if(confirm("Hard reset?")) { localStorage.clear(); window.location.reload(); } }} className="text-[9px] font-black text-red-600 uppercase underline decoration-2 underline-offset-4">Reset Application Cache</button>
                 </div>
              </div>
           </div>
        )}
      </div>

      {showProductModal && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[500] flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-xl rounded-[4rem] p-12 shadow-2xl relative border-4 border-indigo-600 animate-scaleIn">
            <h3 className="text-3xl font-black uppercase italic tracking-tighter mb-8">Product Details</h3>
            <form onSubmit={handleSaveProduct} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <input required placeholder="Code" className="w-full p-6 bg-slate-50 border-4 border-transparent rounded-[2rem] font-black outline-none focus:border-indigo-600 transition-all uppercase" value={editingProduct?.itemCode || ''} onChange={e => setEditingProduct(prev => prev ? {...prev, itemCode: e.target.value} : null)} />
                <select className="w-full p-6 bg-slate-50 border-4 border-transparent rounded-[2rem] font-black outline-none focus:border-indigo-600 transition-all uppercase" value={editingProduct?.unit || 'pcs'} onChange={e => setEditingProduct(prev => prev ? {...prev, unit: e.target.value} : null)}>
                  <option value="pcs">pcs</option><option value="mtr">mtr</option><option value="kg">kg</option>
                </select>
              </div>
              <input required placeholder="Product Name" className="w-full p-6 bg-slate-50 border-4 border-transparent rounded-[2rem] font-black outline-none focus:border-indigo-600 transition-all uppercase" value={editingProduct?.name || ''} onChange={e => setEditingProduct(prev => prev ? {...prev, name: e.target.value} : null)} />
              <div className="grid grid-cols-3 gap-6">
                <input type="number" step="0.01" required placeholder="Price" className="w-full p-6 bg-slate-50 border-4 border-transparent rounded-[2rem] font-black outline-none focus:border-indigo-600" value={editingProduct?.price || ''} onChange={e => setEditingProduct(prev => prev ? {...prev, price: parseFloat(e.target.value)} : null)} />
                <select className="w-full p-6 bg-slate-50 border-4 border-transparent rounded-[2rem] font-black outline-none focus:border-indigo-600" value={editingProduct?.gstRate || 0} onChange={e => setEditingProduct(prev => prev ? {...prev, gstRate: parseInt(e.target.value)} : null)}>
                  {GST_RATES.map(rate => <option key={rate} value={rate}>{rate}%</option>)}
                </select>
                <input type="number" step="0.001" required placeholder="Stock" className="w-full p-6 bg-slate-50 border-4 border-transparent rounded-[2rem] font-black outline-none focus:border-indigo-600" value={editingProduct?.stockQuantity || ''} onChange={e => setEditingProduct(prev => prev ? {...prev, stockQuantity: parseFloat(e.target.value)} : null)} />
              </div>
              <div className="flex items-center space-x-4 pt-6">
                <button type="button" onClick={() => { setShowProductModal(false); setEditingProduct(null); }} className="flex-1 bg-slate-100 py-6 rounded-[2rem] font-black uppercase text-[11px]">Cancel</button>
                <button type="submit" className="flex-[2] bg-indigo-600 text-white py-6 rounded-[2rem] font-black uppercase text-[11px] shadow-xl">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCompanyModal && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[500] flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-2xl rounded-[4rem] p-10 shadow-2xl relative border-4 border-indigo-600 animate-scaleIn overflow-y-auto max-h-[90vh]">
            <h3 className="text-3xl font-black uppercase italic tracking-tighter mb-8 px-4 text-center">Company Profile</h3>
            <form onSubmit={handleSaveCompany} className="space-y-6 px-4">
              <div className="flex flex-col items-center mb-6">
                <div onClick={() => fileInputRef.current?.click()} className="w-32 h-32 border-4 border-dashed border-slate-200 rounded-[2rem] flex items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all overflow-hidden relative">
                  {editingCompany?.logoUrl ? <img src={editingCompany.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" /> : <i className="fas fa-image text-3xl text-slate-300"></i>}
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Header Top Line (Tagline/Regional)</label>
                  <input className="w-full p-5 bg-slate-50 border-4 border-transparent rounded-[1.5rem] font-black text-sm outline-none focus:border-indigo-600 transition-all"
                    placeholder="E.g., || Shree Ganeshay Namah ||"
                    value={editingCompany?.headerTopLine || ''} onChange={e => setEditingCompany(prev => prev ? {...prev, headerTopLine: e.target.value} : null)} />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Primary Brand Name (English)</label>
                  <input className="w-full p-5 bg-slate-50 border-4 border-transparent rounded-[1.5rem] font-black text-sm outline-none focus:border-indigo-600 transition-all uppercase"
                    value={editingCompany?.name || ''} onChange={e => setEditingCompany(prev => prev ? {...prev, name: e.target.value} : null)} />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Secondary Brand Name (Regional)</label>
                  <input className="w-full p-5 bg-slate-50 border-4 border-transparent rounded-[1.5rem] font-black text-sm outline-none focus:border-indigo-600 transition-all"
                    value={editingCompany?.nameSecondary || ''} onChange={e => setEditingCompany(prev => prev ? {...prev, nameSecondary: e.target.value} : null)} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <input required placeholder="GSTIN" className="w-full p-5 bg-slate-50 border-4 border-transparent rounded-[1.5rem] font-black text-sm outline-none focus:border-indigo-600 uppercase"
                    value={editingCompany?.gstin || ''} onChange={e => setEditingCompany(prev => prev ? {...prev, gstin: e.target.value} : null)} />
                  <input required placeholder="Prefix" className="w-full p-5 bg-slate-50 border-4 border-transparent rounded-[1.5rem] font-black text-sm outline-none focus:border-indigo-600 uppercase"
                    value={editingCompany?.invoicePrefix || ''} onChange={e => setEditingCompany(prev => prev ? {...prev, invoicePrefix: e.target.value} : null)} />
                </div>

                <div className="bg-slate-50 p-6 rounded-[2rem] grid grid-cols-2 gap-4">
                  <input placeholder="Address Line 1" className="w-full p-4 bg-white border-2 border-slate-200 rounded-xl font-black text-[11px]" value={editingCompany?.addressLine1 || ''} onChange={e => setEditingCompany(prev => prev ? {...prev, addressLine1: e.target.value} : null)} />
                  <input placeholder="Address Line 2" className="w-full p-4 bg-white border-2 border-slate-200 rounded-xl font-black text-[11px]" value={editingCompany?.addressLine2 || ''} onChange={e => setEditingCompany(prev => prev ? {...prev, addressLine2: e.target.value} : null)} />
                  <input placeholder="Contact Number" className="w-full p-4 bg-white border-2 border-slate-200 rounded-xl font-black text-[11px]" value={editingCompany?.contactNumber || ''} onChange={e => setEditingCompany(prev => prev ? {...prev, contactNumber: e.target.value} : null)} />
                  <input placeholder="Merchant UPI ID" className="w-full p-4 bg-white border-2 border-slate-200 rounded-xl font-black text-[11px]" value={editingCompany?.upiId || ''} onChange={e => setEditingCompany(prev => prev ? {...prev, upiId: e.target.value} : null)} />
                </div>
              </div>

              <div className="flex items-center space-x-4 pt-6 pb-10">
                <button type="button" onClick={() => { setShowCompanyModal(false); setEditingCompany(null); }} className="flex-1 bg-slate-100 py-6 rounded-[2rem] font-black uppercase text-[11px]">Cancel</button>
                <button type="submit" className="flex-[2] bg-indigo-600 text-white py-6 rounded-[2rem] font-black uppercase text-[11px] shadow-xl">Save Hub</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedReceipt && <Receipt invoice={selectedReceipt} onClose={() => setSelectedReceipt(null)} />}
    </div>
  );
};

export default AdminDashboard;
