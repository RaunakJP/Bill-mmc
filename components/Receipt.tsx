import * as React from 'react';
import { Invoice, PrinterConfig } from '../types';

const { useState, useEffect, useMemo } = React;

interface ReceiptProps {
  invoice: Invoice;
  printerConfig?: PrinterConfig;
  onClose?: () => void;
}

const Receipt: React.FC<ReceiptProps> = ({ invoice, printerConfig, onClose }) => {
  const [localInvoice, setLocalInvoice] = useState<Invoice>({ ...invoice });
  
  const config = printerConfig || { 
    paperWidth: '70mm', 
    autoPrint: false, 
    showQr: true, 
    topMargin: 0,
    connectionType: 'SYSTEM'
  };

  useEffect(() => {
    setLocalInvoice({ ...invoice });
    const style = document.createElement('style');
    style.innerHTML = `
      @page { size: ${config.paperWidth} auto; margin: 0; }
      @media print {
        body { width: ${config.paperWidth}; margin: 0; padding: 0; background: white; }
        #root { display: none; }
        .print-area { display: block !important; width: ${config.paperWidth} !important; padding-top: ${config.topMargin}mm !important; }
      }
    `;
    document.head.appendChild(style);
    return () => { if(document.head.contains(style)) document.head.removeChild(style); };
  }, [invoice, config.paperWidth, config.topMargin]);

  const totals = useMemo(() => {
    const itemCount = localInvoice.items.length;
    const qtySum = localInvoice.items.reduce((sum, item) => sum + item.quantity, 0);
    return { itemCount, qtySum };
  }, [localInvoice.items]);

  const formatQuantity = (qty: number, unit: string) => unit === 'mtr' ? qty.toFixed(2) : qty.toString();

  const upiPayUri = localInvoice.upiId ? `upi://pay?pa=${localInvoice.upiId}&pn=${encodeURIComponent(localInvoice.companyName || localInvoice.companyNameSecondary || 'Merchant')}&am=${localInvoice.totalAmount}&cu=INR` : '';
  const upiQrUrl = upiPayUri ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiPayUri)}` : '';

  const transactionDate = new Date(localInvoice.date);
  const formattedDate = transactionDate.toLocaleDateString('en-GB');
  const formattedTime = transactionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[200] flex items-center justify-center p-2 overflow-y-auto no-print">
      <div className="bg-white p-5 font-mono text-[10px] print-area relative shadow-2xl rounded-sm print:rounded-none print:shadow-none" style={{ width: config.paperWidth }}>
        
        <div className="absolute -top-12 left-0 right-0 flex justify-between no-print px-1">
          <button onClick={onClose} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-black text-[9px] uppercase shadow-lg">Close</button>
          <button onClick={() => window.print()} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-black text-[9px] uppercase shadow-lg flex items-center"><i className="fas fa-print mr-2"></i> Print</button>
        </div>

        {localInvoice.headerTopLine && (
          <div className="text-center text-[8px] font-black uppercase mb-1 border-b border-slate-100 pb-1 italic">
            {localInvoice.headerTopLine}
          </div>
        )}

        <div className="text-center mb-4 space-y-1">
          {localInvoice.companyNameSecondary && <h1 className="text-lg font-black leading-none mb-1">{localInvoice.companyNameSecondary}</h1>}
          <h2 className="font-black uppercase tracking-tight text-sm leading-tight">{localInvoice.companyName || 'RETAIL INVOICE'}</h2>
          
          <div className="mt-2 space-y-0.5 text-[7px] font-black uppercase tracking-tight border-t border-slate-100 pt-1 opacity-70">
            {localInvoice.addressLine1 && <p>{localInvoice.addressLine1}</p>}
            {localInvoice.addressLine2 && <p>{localInvoice.addressLine2}</p>}
            {localInvoice.contactNumber && <p>Ph: {localInvoice.contactNumber}</p>}
          </div>
          <p className="text-[8px] font-bold mt-2 uppercase border-t border-slate-100 pt-1">GSTIN: {localInvoice.gstin}</p>
        </div>

        <div className="flex justify-between items-start border-b border-dashed border-slate-400 pb-2 mb-3 uppercase">
          <span className="text-[14px] font-black tracking-tight leading-none">#{localInvoice.invoiceNumber}</span>
          <div className="text-right flex flex-col items-end">
            <span className="text-[12px] font-black tracking-tight leading-none">{formattedDate}</span>
            <span className="text-[7px] font-bold opacity-60 mt-1">{formattedTime}</span>
          </div>
        </div>

        <table className="w-full mb-3 text-[9px]">
          <thead>
            <tr className="border-b-2 border-slate-900 font-black uppercase text-left">
              <th className="py-1">Item</th>
              <th className="py-1 text-center">Qty</th>
              <th className="py-1 text-center">Rate</th>
              <th className="py-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {localInvoice.items.map((item, idx) => (
              <tr key={idx} className="border-b border-dotted border-slate-300 align-top">
                <td className="py-2 pr-1 font-black uppercase">
                  {item.name}
                </td>
                <td className="py-2 text-center font-bold whitespace-nowrap">{formatQuantity(item.quantity, item.unit)}</td>
                <td className="py-2 text-center font-bold whitespace-nowrap">{item.price.toFixed(2)}</td>
                <td className="py-2 text-right font-black whitespace-nowrap">{item.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pt-2 border-t-2 border-slate-900 font-black flex flex-col text-[8px] uppercase italic border-b border-slate-50 pb-1 mb-1 opacity-70">
          <div className="flex justify-between">
            <span>Items Count: {totals.itemCount}</span>
            <span>Total Qty: {totals.qtySum.toFixed(2).replace(/\.00$/, '')}</span>
          </div>
        </div>

        <div className="space-y-0.5 pt-2 font-black text-[10px]">
          <div className="flex justify-between items-center py-1.5 text-[15px] border-b-2 border-slate-900">
            <span>GRAND TOTAL</span>
            <span>₹{localInvoice.totalAmount.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-4 pt-1 flex justify-between text-[7px] font-black uppercase tracking-widest opacity-60">
          <span>Payment: {localInvoice.paymentMethod}</span>
          <span>Verified Terminal: {localInvoice.deviceName}</span>
        </div>

        {config.showQr && localInvoice.paymentMethod === 'UPI' && upiQrUrl && (
          <div className="mt-4 flex flex-col items-center border-t border-dashed border-slate-200 pt-3">
            <img src={upiQrUrl} alt="QR" className="w-24 h-24 border p-1" />
            <p className="text-[7px] font-bold mt-2 uppercase tracking-tighter text-slate-400">{localInvoice.upiId}</p>
          </div>
        )}

        <div className="mt-8 text-center text-[9px] font-black tracking-[0.2em] border-t-2 border-slate-900 pt-4 uppercase">
          {localInvoice.thankYouEmojiStart && <span className="text-sm mr-2">{localInvoice.thankYouEmojiStart}</span>}
          THANK YOU VISIT AGAIN
          {localInvoice.thankYouEmojiEnd && <span className="text-sm ml-2">{localInvoice.thankYouEmojiEnd}</span>}
        </div>
      </div>
    </div>
  );
};

export default Receipt;