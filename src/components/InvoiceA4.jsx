import React, { forwardRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

const InvoiceA4 = forwardRef(({ sale, companyInfo, useTwoDecimals = true, context }, ref) => {
  const { t } = useLanguage();

  // Ensure we have proper defaults
  const safeCompanyInfo = {
    name: companyInfo.name || 'Toko',
    address: companyInfo.address || '',
    phone: companyInfo.phone || '',
    logoUrl: companyInfo.logoUrl || companyInfo.logo || '/logo.png'
  };

  // Format date in Indonesian locale
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  // Format currency in Indonesian Rupiah
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: useTwoDecimals ? 2 : 0,
      maximumFractionDigits: useTwoDecimals ? 2 : 0
    }).format(amount);
  };

  const formatCurrencyCompact = (amount = 0) => {
    const numericValue = typeof amount === 'number' ? amount : Number(amount) || 0;
    return `Rp. ${numericValue.toLocaleString('id-ID')}`;
  };

  // Ensure logo is always displayed with a fallback
  const getLogoSrc = () => {
    if (safeCompanyInfo.logoUrl && safeCompanyInfo.logoUrl !== '') {
      return safeCompanyInfo.logoUrl;
    }
    // Fallback to default logo
    return '/logo.png';
  };

  // Ensure company info is displayed with fallbacks
  const companyName = safeCompanyInfo.name;
  const companyAddress = safeCompanyInfo.address;
  const companyPhone = safeCompanyInfo.phone;

  const discountPercent = Number(sale.discount_percent || 0);
  const taxPercent = Number(sale.tax_percent || 0);
  const subtotal = Number(sale.subtotal || 0);
  const discountAmount = sale.discount_amount !== undefined
    ? Number(sale.discount_amount)
    : subtotal * (discountPercent / 100);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = sale.tax_amount !== undefined
    ? Number(sale.tax_amount)
    : taxableAmount * (taxPercent / 100);

  const discountLabel = discountPercent ? `${t('discountLabel')} ${discountPercent}%` : t('discountLabel');
  const taxLabel = taxPercent ? `${t('taxLabel')} ${taxPercent}%` : t('taxLabel');
  const totalAmount = Number(sale.total_amount || subtotal - discountAmount + taxAmount);

  // Dynamic horizontal padding adjustments per page context
  const baseLeftCh = 8;
  const baseRightCh = 2;
  const leftCh = context === 'sales' ? Math.max(0, baseLeftCh - 3) : context === 'reports' ? Math.max(0, baseLeftCh - 2) : baseLeftCh;
  const rightCh = context === 'reports' ? Math.max(0, baseRightCh - 2) : baseRightCh;

  return (
    <div ref={ref} className="printable-invoice-area">
      <div
        className="invoice-container bg-white mx-auto font-sans"
        style={{
          width: '21cm',
          minHeight: '29.7cm',
          paddingTop: '25mm',
          paddingBottom: '25mm',
          paddingLeft: `${leftCh}ch`,
          paddingRight: `${rightCh}ch`
        }}
      >
        {/* Header Section */}
        <header className="mb-8">
          {/* Baris Atas: Logo & Info Perusahaan di Kiri, Tanggal di Kanan */}
          <div className="flex justify-between items-start mb-4">
            {/* Kiri: Logo dan Info Perusahaan */}
            <div className="text-left">
              <img 
                src={getLogoSrc()} 
                alt={t('companyLogoAlt')} 
                className="h-16 w-auto mb-4"
                onError={(e) => {
                  // If even the fallback fails, show no logo
                  e.target.style.display = 'none';
                }}
              />
              <h1 className="text-xl font-bold text-gray-800">{companyName}</h1>
              {companyAddress && <p className="text-sm text-gray-600">{companyAddress}</p>}
              {companyPhone && <p className="text-sm text-gray-600">{t('phoneLabel')}: {companyPhone}</p>
}
            </div>
            
            {/* Kanan: Tanggal Invoice */}
            <div className="text-right">
              <p className="text-sm text-gray-600">{t('invoiceDateLabel')}:</p>
              <p className="text-md text-gray-800 mb-4">{formatDate(sale.created_at)}</p>
              {/* Customer Information */}
              {sale.customer && sale.customer.name && sale.customer.name !== 'Pelanggan Umum' && sale.customer.name !== 'Default Customer' && sale.customer.name !== '默认客户' && (
                <div className="text-right">
                  <p className="text-md font-bold text-gray-800">{sale.customer.name}</p>
                  {sale.customer.address && (
                    <p className="text-sm text-gray-600">{sale.customer.address}</p>
                  )}
                  {sale.customer.phone && (
                    <p className="text-sm text-gray-600">{t('phoneLabel')}: {sale.customer.phone}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Baris Tengah: Judul "INVOICE" */}
          <div className="text-center my-8">
            <h2 className="text-3xl font-bold uppercase tracking-wider text-gray-900">{t('invoiceTitle')}</h2>
          </div>
        </header>

        {/* Body Section - Items Table */}
        <main className="mb-8">
          <table className="w-full text-left text-base border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="p-3 font-bold uppercase text-gray-700">{t('descriptionLabel')}</th>
                <th className="p-3 font-bold uppercase text-gray-700">Barcode</th>
                <th className="p-3 font-bold uppercase text-gray-700 text-center">{t('quantityLabel')}</th>
                <th className="p-3 font-bold uppercase text-gray-700 text-right">Harga</th>
                <th className="p-3 font-bold uppercase text-gray-700 text-right">{t('subtotalLabel')}</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, index) => {
                const subtotal = item.price * item.quantity;
                return (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="p-3">{item.product_name}</td>
                    <td className="p-3">{item.barcode || '-'}</td>
                    <td className="p-3 text-center">{item.quantity}</td>
                    <td className="p-3 text-right">{formatCurrency(item.price)}</td>
                    <td className="p-3 text-right">{formatCurrency(subtotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </main>

        {/* Totals & Signature Section */}
        <section className="flex justify-between items-end mb-12">
          <div className="flex flex-col justify-end">
            <div className="border-t border-gray-400 w-48"></div>
            <p className="text-sm font-semibold text-gray-700 mt-2">{t('signatureLabel') || 'Tanda Tangan'}</p>
          </div>

          <div className="w-72 text-base space-y-2">
            {sale.subtotal > 0 && (
              <div className="flex justify-between py-2 border-b border-gray-300">
                <span className="text-gray-600">{t('subtotalLabel')}</span>
                <span className="font-bold text-gray-800">{formatCurrency(sale.subtotal)}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex justify-between py-2 border-b border-gray-300">
                <span className="text-gray-600">{discountLabel}</span>
                <span className="font-bold text-gray-800">{formatCurrency(discountAmount)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between py-2 border-b border-gray-300">
                <span className="text-gray-600">{taxLabel}</span>
                <span className="font-bold text-gray-800">{formatCurrency(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-gray-300">
              <span className="text-gray-600">{t('totalLabel')}</span>
              <span className="font-bold text-gray-800">{formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
});

InvoiceA4.displayName = 'InvoiceA4';

export default InvoiceA4;
