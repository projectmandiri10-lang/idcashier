import React, { useRef, forwardRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const ReceiptContent = forwardRef(({ cart, subtotal, discountPercent, discountAmount, taxPercent, taxAmount, total, paymentAmount, change, customer, paperSize, settings, useTwoDecimals = true, t }, ref) => {
  const isA4 = paperSize === 'A4';
  const styles = {
    '58mm': { width: '58mm', fontSize: '10px', padding: `${settings.margin}px` },
    '80mm': { width: '80mm', fontSize: '12px', padding: `${settings.margin}px` },
    'A4': { width: '210mm', fontSize: '12px', padding: `${settings.margin}px` },
  };

  // Debug settings
  console.log('PrintReceipt settings received:', settings);

  // Format number based on useTwoDecimals setting
  const formatNumber = (num) => {
    if (typeof num !== 'number') return '0';
    if (useTwoDecimals) {
      return num.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const safeToLocaleString = (num) => {
    return formatNumber(num);
  };

  // Ensure logo is always displayed with a fallback
  const getLogoSrc = () => {
    if (settings.logo && settings.logo !== '') {
      return settings.logo;
    }
    // Fallback to default logo
    return '/logo.png';
  };

  // Ensure address and phone are displayed with fallbacks
  const shouldShowAddress = settings.showAddress !== false && (settings.address || '');
  const shouldShowPhone = settings.showPhone !== false && (settings.phone || '');

  return (
    <div ref={ref} style={styles[paperSize]} className="receipt-printable bg-white text-black font-mono">
      <div className="text-center">
        <img src={getLogoSrc()} alt={t('logoAlt')} className="w-16 mx-auto mb-2" onError={(e) => {
          // If even the fallback fails, show no logo
          e.target.style.display = 'none';
        }} />
        <h2 className="font-bold text-lg">{settings.name || 'Toko'}</h2>
        {settings.showHeader !== false && settings.headerText && <p>{settings.headerText}</p>}
        {shouldShowAddress && <p>{settings.address}</p>}
        {shouldShowPhone && <p>{settings.phone}</p>}
        <hr className="border-dashed border-black my-2" />
      </div>
      <div>
        <p>{t('invoiceNumber')}: INV/{new Date().getTime()}</p>
        <p>{t('cashierLabel')}: Admin</p>
        <p>{t('customerLabel')}: {customer?.name || t('generalCustomer')}</p>
        <p>{t('dateLabel')}: {new Date().toLocaleString('id-ID')}</p>
      </div>
      <hr className="border-dashed border-black my-2" />
      {isA4 ? (
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="py-1 px-2">{t('productLabel')}</th>
              <th className="py-1 px-2">{t('barcodeLabel')}</th>
              <th className="py-1 px-2 text-right">{t('priceLabel')}</th>
              <th className="py-1 px-2 text-center">{t('qtyLabel')}</th>
              <th className="py-1 px-2 text-right">{t('subtotalLabel')}</th>
            </tr>
          </thead>
          <tbody>
            {cart.map(item => (
              <tr key={item.id}>
                <td className="py-1 px-2">{item.name}</td>
                <td className="py-1 px-2">{item.barcode}</td>
                <td className="py-1 px-2 text-right">{safeToLocaleString(item.price)}</td>
                <td className="py-1 px-2 text-center">{item.quantity}</td>
                <td className="py-1 px-2 text-right">{safeToLocaleString(item.price * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        cart.map(item => (
          <div key={item.id}>
            <p>{item.name}</p>
            <div className="flex justify-between">
              <span>{item.quantity} x {safeToLocaleString(item.price)}</span>
              <span>{safeToLocaleString(item.price * item.quantity)}</span>
            </div>
          </div>
        ))
      )}
      <hr className="border-dashed border-black my-2" />
      <div className="space-y-1">
        <div className="flex justify-between"><p>{t('subtotalLabel')}:</p><p>{safeToLocaleString(subtotal)}</p></div>
        {discountAmount > 0 && <div className="flex justify-between"><p>{t('discountLabel')} ({discountPercent}%):</p><p>-{safeToLocaleString(discountAmount)}</p></div>}
        {taxAmount > 0 && <div className="flex justify-between"><p>{t('taxLabel')} ({taxPercent}%):</p><p>{safeToLocaleString(taxAmount)}</p></div>
}
        <hr className="border-dashed border-black my-1" />
        <div className="flex justify-between font-bold"><p>{t('totalLabel')}:</p><p>{safeToLocaleString(total)}</p></div>
        {paymentAmount > 0 && <div className="flex justify-between"><p>{t('payLabel')}:</p><p>{safeToLocaleString(paymentAmount)}</p></div>}
        {change > 0 && <div className="flex justify-between"><p>{t('changeLabel')}:</p><p>{safeToLocaleString(change)}</p></div>}
      </div>
      <hr className="border-dashed border-black my-2" />
      <div className="text-center">
        {settings.showFooter !== false && settings.footerText && <p>{settings.footerText}</p>}
      </div>
    </div>
  );
});

ReceiptContent.displayName = 'ReceiptContent';
export { ReceiptContent };

const PrintReceipt = forwardRef(({ paperSize, setPaperSize, settings, hideInternalPrintButton = false, ...props }, ref) => {
  const componentRef = ref || useRef();
  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    documentTitle: `receipt-idcashier-${new Date().getTime()}`,
  });
  const { t } = useLanguage();

  return (
    <div>
      <Tabs value={paperSize} onValueChange={setPaperSize} className="mb-4">
        <TabsList>
          <TabsTrigger value="58mm">58mm</TabsTrigger>
          <TabsTrigger value="80mm">80mm</TabsTrigger>
          <TabsTrigger value="A4">A4</TabsTrigger>
        </TabsList>
      </Tabs>
      {!hideInternalPrintButton && (
        <div className="flex items-center gap-4 mb-4">
          <div className="text-sm text-muted-foreground">
            {t('paperSize')}: {paperSize}
          </div>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> {t('printButton')}
          </Button>
        </div>
      )}
      <div className="bg-gray-200 p-4 rounded-md overflow-auto max-h-[60vh]">
        <div style={{ transform: 'scale(1)', transformOrigin: 'top left' }}>
          <ReceiptContent {...props} settings={settings} paperSize={paperSize} t={t} ref={componentRef} />
        </div>
      </div>
    </div>
  );
});

PrintReceipt.displayName = 'PrintReceipt';

export default PrintReceipt;