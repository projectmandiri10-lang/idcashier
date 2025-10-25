import { useEffect } from 'react';

/**
 * Custom hook untuk inject CSS print secara dinamis
 * Hanya CSS untuk tipe yang dipilih yang dimuat ke <head>
 * Otomatis cleanup saat unmount atau type berubah
 */
export const usePrintStyles = (printType) => {
  useEffect(() => {
    if (!printType) return;

    const styles = {
      'invoice-a4': `
        @page {
          size: A4;
          margin: 15mm;
        }

        @media print {
          body[data-print-type="invoice-a4"] * {
            visibility: hidden;
          }

          body[data-print-type="invoice-a4"] [role="dialog"],
          body[data-print-type="invoice-a4"] [role="dialog"] * {
            visibility: visible;
          }

          body[data-print-type="invoice-a4"] [role="dialog"] {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            transform: none !important;
          }

          body[data-print-type="invoice-a4"] .printable-invoice-area,
          body[data-print-type="invoice-a4"] .printable-invoice-area * {
            visibility: visible;
          }

          body[data-print-type="invoice-a4"] .invoice-container {
            width: 21cm !important;
            min-height: 29.7cm !important;
            padding-top: 25mm !important;
            padding-bottom: 25mm !important;
            padding-left: 8ch !important;
            padding-right: 2ch !important;
            font-size: 14px;
            color: #000 !important;
            background: #fff !important;
          }

          body[data-print-type="invoice-a4"] .invoice-container table th,
          body[data-print-type="invoice-a4"] .invoice-container table td {
            padding: 8px !important;
            font-size: 13px !important;
          }

          body[data-print-type="invoice-a4"] .invoice-container h1,
          body[data-print-type="invoice-a4"] .invoice-container h2 {
            font-size: 18px !important;
          }
        }
      `,

      'thermal-58mm': `
        @page {
          size: 58mm 200mm;
          margin: 2mm;
        }

        @media print {
          body[data-print-type="thermal-58mm"] * {
            visibility: hidden;
          }

          body[data-print-type="thermal-58mm"] [role="dialog"],
          body[data-print-type="thermal-58mm"] [role="dialog"] * {
            visibility: visible;
          }

          body[data-print-type="thermal-58mm"] .receipt-printable,
          body[data-print-type="thermal-58mm"] .receipt-printable * {
            visibility: visible !important;
          }

          body[data-print-type="thermal-58mm"] .receipt-printable {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 54mm !important;
            margin: 0 auto !important;
            padding: 5px !important;
            font-size: 10px !important;
            font-family: 'Courier New', Courier, monospace !important;
            color: #000 !important;
            background: #fff !important;
          }

          body[data-print-type="thermal-58mm"] .receipt-printable img {
            max-width: 48px !important;
            margin: 0 auto !important;
          }

          body[data-print-type="thermal-58mm"] .receipt-printable table th,
          body[data-print-type="thermal-58mm"] .receipt-printable table td {
            padding: 2px 4px !important;
            font-size: 9px !important;
            border: none !important;
          }

          body[data-print-type="thermal-58mm"] .receipt-printable hr {
            margin: 5px 0 !important;
          }
        }
      `,

      'thermal-80mm': `
        @page {
          size: 80mm 200mm;
          margin: 2mm;
        }

        @media print {
          body[data-print-type="thermal-80mm"] * {
            visibility: hidden;
          }

          body[data-print-type="thermal-80mm"] [role="dialog"],
          body[data-print-type="thermal-80mm"] [role="dialog"] * {
            visibility: visible;
          }

          body[data-print-type="thermal-80mm"] .receipt-printable,
          body[data-print-type="thermal-80mm"] .receipt-printable * {
            visibility: visible !important;
          }

          body[data-print-type="thermal-80mm"] .receipt-printable {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 76mm !important;
            margin: 0 auto !important;
            padding: 10px !important;
            font-size: 12px !important;
            font-family: 'Courier New', Courier, monospace !important;
            color: #000 !important;
            background: #fff !important;
          }

          body[data-print-type="thermal-80mm"] .receipt-printable img {
            max-width: 64px !important;
            margin: 0 auto !important;
          }

          body[data-print-type="thermal-80mm"] .receipt-printable table th,
          body[data-print-type="thermal-80mm"] .receipt-printable table td {
            padding: 3px 5px !important;
            font-size: 11px !important;
            border: none !important;
          }

          body[data-print-type="thermal-80mm"] .receipt-printable hr {
            margin: 8px 0 !important;
          }
        }
      `,

      'thermal-a4': `
        @page {
          size: A4;
          margin: 10mm;
        }

        @media print {
          body[data-print-type="thermal-a4"] * {
            visibility: hidden;
          }

          body[data-print-type="thermal-a4"] [role="dialog"],
          body[data-print-type="thermal-a4"] [role="dialog"] * {
            visibility: visible;
          }

          body[data-print-type="thermal-a4"] .receipt-printable,
          body[data-print-type="thermal-a4"] .receipt-printable * {
            visibility: visible !important;
          }

          body[data-print-type="thermal-a4"] .receipt-printable {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            max-width: 300px !important;
            margin: 0 auto !important;
            padding: 15px !important;
            font-size: 12px !important;
            font-family: 'Courier New', Courier, monospace !important;
            color: #000 !important;
            background: #fff !important;
            border: 1px dashed #ccc !important;
          }

          body[data-print-type="thermal-a4"] .receipt-printable table th,
          body[data-print-type="thermal-a4"] .receipt-printable table td {
            padding: 4px 6px !important;
            font-size: 11px !important;
            border: none !important;
          }
        }
      `,
    };

    const css = styles[printType];
    if (!css) {
      return;
    }

    const existingStyle = document.getElementById('dynamic-print-styles');
    if (existingStyle) {
      existingStyle.remove();
    }

    document.body.setAttribute('data-print-type', printType);

    const styleElement = document.createElement('style');
    styleElement.id = 'dynamic-print-styles';
    styleElement.innerHTML = css;
    document.head.appendChild(styleElement);

    return () => {
      const styleEl = document.getElementById('dynamic-print-styles');
      if (styleEl) {
        styleEl.remove();
      }
      document.body.removeAttribute('data-print-type');
    };
  }, [printType]);
};


