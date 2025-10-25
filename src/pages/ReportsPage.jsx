import React, { useState, useEffect, useMemo, useRef } from 'react';

import { Helmet } from 'react-helmet';

import { useLanguage } from '@/contexts/LanguageContext';

import { usePrintStyles } from '@/hooks/usePrintStyles';

import { useToast } from '@/components/ui/use-toast';

import { useNavigation } from '@/contexts/NavigationContext';

import { Button } from '@/components/ui/button';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Label } from '@/components/ui/label';

import { Switch } from '@/components/ui/switch'; // Import the Switch component

import { Download, Calendar as CalendarIcon, Search, Trash2, RefreshCw, Printer } from 'lucide-react';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { Calendar } from "@/components/ui/calendar";

import { format } from "date-fns";

import { cn, exportToExcel } from "@/lib/utils";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { salesAPI, productsAPI, suppliersAPI } from '@/lib/api';

import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

import { useReactToPrint } from 'react-to-print';

import InvoiceA4 from '@/components/InvoiceA4';

import PrintReceipt, { ReceiptContent } from '@/components/PrintReceipt';

import {

  Dialog,

  DialogContent,

  DialogHeader,

  DialogTitle,

} from "@/components/ui/dialog";



const ReportsPage = () => {

  const { t } = useLanguage();

  const { toast } = useToast();

  const { navigationParams } = useNavigation();

  const { user, token } = useAuth();

  const permissions = usePermissions();

  const [dateRange, setDateRange] = useState({ from: new Date(2025, 9, 20), to: new Date(2025, 9, 26) });

  const [selectedProduct, setSelectedProduct] = useState(t('allProducts'));

  const [selectedCustomer, setSelectedCustomer] = useState(t('allCustomers'));

  const [selectedSupplier, setSelectedSupplier] = useState(t('allSuppliers'));

  const [filteredData, setFilteredData] = useState([]);

  const [allSalesData, setAllSalesData] = useState([]);

  const [products, setProducts] = useState([t('allProducts')]);

  const [customers, setCustomers] = useState([t('allCustomers')]);

  const [suppliers, setSuppliers] = useState([t('allSuppliers')]);

  const [productsMap, setProductsMap] = useState({});

  const [selectedTransactions, setSelectedTransactions] = useState(new Set());

  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState(null);

  const [retryCount, setRetryCount] = useState(0);

  const [activeTab, setActiveTab] = useState('overview');

  

  // A4 Invoice Printing States

  const [selectedSaleForPrint, setSelectedSaleForPrint] = useState(null);

  const invoiceRef = useRef();

  const [companyInfo, setCompanyInfo] = useState({ 

    name: 'Toko', 

    address: '', 

    phone: '', 

    logoUrl: '/logo.png',

    logo: '/logo.png',

    headerText: '',

    footerText: '',

    showAddress: true,

    showPhone: true,

    showHeader: true,

    showFooter: true,

    margin: 10

  });

  

  // New states for print dialog

  const [showPrintDialog, setShowPrintDialog] = useState(false);

  const [receiptType, setReceiptType] = useState('thermal-80mm');
  const [useTwoDecimals, setUseTwoDecimals] = useState(true);

  const printRef = useRef();

  // Dynamic CSS injection - hanya load CSS untuk tipe yang dipilih
  usePrintStyles(showPrintDialog ? receiptType : null);
  

  // Filter state for corrupt data

  const [hideCorruptData, setHideCorruptData] = useState(false);



  // Handle navigation parameters

  useEffect(() => {

    if (navigationParams && navigationParams.activeTab) {

      setActiveTab(navigationParams.activeTab);

    }

  }, [navigationParams]);



  // Load company settings for invoice printing

  const loadCompanySettings = async () => {

    if (!user) return;

    

    try {

      // Get ownerId based on user role

      const ownerId = user.role === 'cashier' ? user.tenantId : user.id;

      

      let mergedSettings = {

        logo: '',

        name: '',

        address: '',

        phone: '',

        headerText: '',

        footerText: t('receiptFooter'),

        showAddress: true,

        showPhone: true,

        showHeader: true,

        showFooter: true,

        margin: 10,

      };

      

      console.log('Loading company settings for ownerId:', ownerId);

      

      if (ownerId) {

        // Try to load user-specific store settings

        const savedStoreSettings = localStorage.getItem(`idcashier_store_settings_${ownerId}`);

        const savedReceiptSettings = localStorage.getItem(`idcashier_receipt_settings_${ownerId}`);

        

        console.log('Found user-specific store settings:', savedStoreSettings);

        console.log('Found user-specific receipt settings:', savedReceiptSettings);

        

        if (savedStoreSettings) {

          const storeSettings = JSON.parse(savedStoreSettings);

          mergedSettings = {

            ...mergedSettings,

            ...storeSettings

          };

        }

        

        if (savedReceiptSettings) {

          const receiptSettings = JSON.parse(savedReceiptSettings);

          mergedSettings = {

            ...mergedSettings,

            ...receiptSettings

          };

        }

      } else {

        // Fallback to general settings

        const savedStoreSettings = localStorage.getItem('idcashier_store_settings');

        const savedReceiptSettings = localStorage.getItem('idcashier_receipt_settings');

        

        console.log('Found general store settings:', savedStoreSettings);

        console.log('Found general receipt settings:', savedReceiptSettings);

        

        if (savedStoreSettings) {

          const storeSettings = JSON.parse(savedStoreSettings);

          mergedSettings = {

            ...mergedSettings,

            ...storeSettings

          };

        }

        

        if (savedReceiptSettings) {

          const receiptSettings = JSON.parse(savedReceiptSettings);

          mergedSettings = {

            ...mergedSettings,

            ...receiptSettings

          };

        }

      }

      

      // Log the merged settings for debugging

      console.log('Loaded company settings:', mergedSettings);

      

      // Set company info state with fallback to default logo

      setCompanyInfo({

        name: mergedSettings.name || 'Toko',

        address: mergedSettings.address || '',

        phone: mergedSettings.phone || '',

        logoUrl: mergedSettings.logo || '/logo.png',

        logo: mergedSettings.logo || '/logo.png',

        headerText: mergedSettings.headerText || '',

        footerText: mergedSettings.footerText || t('receiptFooter'),

        showAddress: mergedSettings.showAddress !== false,

        showPhone: mergedSettings.showPhone !== false,

        showHeader: mergedSettings.showHeader !== false,

        showFooter: mergedSettings.showFooter !== false,

        margin: mergedSettings.margin || 10

      });

      

      console.log('Set company info state:', {

        name: mergedSettings.name || 'Toko',

        address: mergedSettings.address || '',

        phone: mergedSettings.phone || '',

        logoUrl: mergedSettings.logo || '/logo.png',

        logo: mergedSettings.logo || '/logo.png',

        headerText: mergedSettings.headerText || '',

        footerText: mergedSettings.footerText || t('receiptFooter'),

        showAddress: mergedSettings.showAddress !== false,

        showPhone: mergedSettings.showPhone !== false,

        showHeader: mergedSettings.showHeader !== false,

        showFooter: mergedSettings.showFooter !== false,

        margin: mergedSettings.margin || 10

      });

    } catch (error) {

      console.error('Error loading company settings:', error);

    }

  };



  // Load company settings when component mounts

  useEffect(() => {

    loadCompanySettings();

  }, [user]);



  // Also load company settings when the component is first mounted

  useEffect(() => {

    // Load company settings immediately when component mounts

    loadCompanySettings();

  }, []);



  // Extract fetchData function to make it accessible from other functions

  const fetchData = async (retryAttempt = 0) => {

    if (!user || !token) {

      // If user or token is missing, show appropriate message

      if (!token) {

        console.warn('No authentication token found. User may need to login.');

        toast({ 

          title: t('authenticationRequired'), 

          description: t('pleaseLoginToViewReports'), 

          variant: 'destructive' 

        });

      } else if (!user) {

        console.warn('No user data found.');

      }

      // Initialize with empty data to prevent app crash

      setAllSalesData([]);

      setFilteredData([]);

      setProducts([t('allProducts')]);

      setCustomers([t('allCustomers')]);

      setSuppliers([t('allSuppliers')]);

      setProductsMap({});

      return;

    }

    

    try {

      setIsLoading(true);

      setError(null);

      

      // Load company settings for invoice printing

      await loadCompanySettings();

      

      // Fetch products data first to get accurate cost and supplier information

      const productsData = await productsAPI.getAll(token);

      

      // Create productsMap from products data: { [product_id]: { name, cost, supplier_name, ... } }

      const productsMapData = {};

      productsData.forEach(product => {

        productsMapData[product.id] = {

          name: product.name,

          cost: product.cost_price || 0,

          supplier_name: product.supplier_name || t('unknownSupplier'),

          ...product

        };

      });

      

      // Set productsMap state

      setProductsMap(productsMapData);

      

      // Fetch suppliers data

      const suppliersData = await suppliersAPI.getAll(token);

      const uniqueSuppliers = [t('allSuppliers'), ...new Set(suppliersData.map(supplier => supplier.name).filter(name => name))];

      setSuppliers(uniqueSuppliers);

      

      // Fetch sales data using the API

      const salesData = await salesAPI.getAll(token);

      

      // Transform data for the reports

      const transformedData = [];

      

      salesData.forEach(sale => {

        // Handle sales with no items

        if (!sale.sale_items || sale.sale_items.length === 0) {

          // Calculate nominal discount and tax from percentages

          const subtotalForSale = 0;

          const discountNominal = subtotalForSale * ((sale.discount || 0) / 100);

          const taxableAmount = subtotalForSale - discountNominal;

          const taxNominal = taxableAmount * ((sale.tax || 0) / 100);

          

          transformedData.push({

            id: sale.id,

            saleId: sale.id,

            itemId: `${sale.id}-0`,

            date: format(new Date(sale.created_at), 'yyyy-MM-dd'),

            product: t('noItems'),

            customer: sale.customer_name || t('unknownCustomer'),

            supplier: t('unknownSupplier'),

            quantity: 0,

            price: 0,

            itemSubtotal: 0,

            cashier: sale.user_name || 'Unknown Cashier',

            payment_amount: sale.payment_amount || 0,

            change_amount: sale.change_amount || 0,

            subtotal: subtotalForSale,

            discount_amount: discountNominal,

            tax_amount: taxNominal,

            total: sale.total_amount || 0,

            cost: 0,

            isFirstItemInSale: true,

            itemCount: 0,

            sale_items: [],

            hasUnknownProduct: true,

            hasUnknownCustomer: !sale.customer_name || sale.customer_name === t('unknownCustomer'),

            hasUnknownSupplier: true,

            hasNegativeTotal: sale.total_amount < 0

          });

          return;

        }

        

        // Process each item in the sale

        const itemCount = sale.sale_items.length;

        let saleSubtotal = 0;

        

        // Calculate total sale subtotal

        sale.sale_items.forEach(item => {

          saleSubtotal += (item.quantity || 0) * (item.price || 0);

        });

        

        // Calculate nominal discount and tax from percentages

        const discountNominal = saleSubtotal * ((sale.discount || 0) / 100);

        const taxableAmount = saleSubtotal - discountNominal;

        const taxNominal = taxableAmount * ((sale.tax || 0) / 100);

        

        sale.sale_items.forEach((item, index) => {

          const quantity = item.quantity || 0;

          const price = item.price || 0;

          const itemSubtotal = quantity * price;

          

          // Get product info

          const product = item.product_name || t('unknownProduct');

          const supplier = (item.product_id && productsMapData[item.product_id]) 

            ? productsMapData[item.product_id].supplier_name 

            : t('unknownSupplier');

          const cost = (item.product_id && productsMapData[item.product_id]) 

            ? productsMapData[item.product_id].cost 

            : 0;

            

          // Check if product has been deleted (unknown product)

          const hasUnknownProduct = !item.product_name || item.product_name === t('unknownProduct');

          

          transformedData.push({

            id: `${sale.id}-${index}`, // Unique ID for this row

            saleId: sale.id, // Original sale ID for operations

            itemId: `${sale.id}-${index}`,

            date: format(new Date(sale.created_at), 'yyyy-MM-dd'),

            product: product,

            customer: sale.customer_name || t('unknownCustomer'),

            supplier: supplier,

            quantity: quantity,

            price: price,

            itemSubtotal: itemSubtotal,

            cashier: sale.user_name || 'Unknown Cashier',

            payment_amount: sale.payment_amount || 0,

            change_amount: sale.change_amount || 0,

            subtotal: saleSubtotal, // Total sale subtotal for all items

            discount_amount: discountNominal,

            tax_amount: taxNominal,

            total: sale.total_amount || 0,

            cost: cost,

            isFirstItemInSale: index === 0, // Only first item shows sale totals

            itemCount: itemCount,

            sale_items: sale.sale_items, // Keep reference to all sale items

            hasUnknownProduct: hasUnknownProduct,

            hasUnknownCustomer: !sale.customer_name || sale.customer_name === t('unknownCustomer'),

            hasUnknownSupplier: !supplier || supplier === t('unknownSupplier'),

            hasNegativeTotal: sale.total_amount < 0

          });

        });

      });

      

      setAllSalesData(transformedData);

      setFilteredData(transformedData);

      

      // Extract unique products and customers from sales data

      // Filter out unknown products from the product list

      const validProducts = transformedData

        .filter(item => !item.hasUnknownProduct)

        .map(item => item.product);

      const uniqueProducts = [t('allProducts'), ...new Set(validProducts)];

      

      // Filter out unknown customers from the customer list

      const validCustomers = transformedData

        .filter(item => !item.hasUnknownCustomer)

        .map(item => item.customer);

      const uniqueCustomers = [t('allCustomers'), ...new Set(validCustomers)];

      

      setProducts(uniqueProducts);

      setCustomers(uniqueCustomers);

      

      // Reset retry count on successful fetch

      setRetryCount(0);

    } catch (error) {

      console.error('Error fetching sales data:', error);

      setError(error.message);

      

      // Check if this is an authentication error

      if (error.message.includes('Akses tidak sah') || error.message.includes('Invalid token') || error.message.includes('401') || error.message.includes('403')) {

        toast({ 

          title: t('authenticationError'), 

          description: t('pleaseLoginAgain'), 

          variant: 'destructive' 

        });

      } else {

        toast({ 

          title: t('error'), 

          description: `${t('failedLoadData')}: ${error.message}`, 

          variant: 'destructive' 

        });

      }

      

      // Retry mechanism - retry up to 3 times with exponential backoff

      if (retryAttempt < 3) {

        const delay = Math.pow(2, retryAttempt) * 1000; // 1s, 2s, 4s

        setTimeout(() => {

          fetchData(retryAttempt + 1);

        }, delay);

        setRetryCount(retryAttempt + 1);

      } else {

        // If there's any error after max retries, initialize with empty data to prevent app crash

        setAllSalesData([]);

        setFilteredData([]);

        setProducts([t('allProducts')]);

        setCustomers([t('allCustomers')]);

        setSuppliers([t('allSuppliers')]);

        setProductsMap({});

        toast({ 

          title: t('error'), 

          description: `${t('failedLoadData')} ${retryAttempt} ${t('attempts')}. ${t('pleaseTryAgain')}`, 

          variant: 'destructive' 

        });

      }

    } finally {

      setIsLoading(false);

    }

  };



  // Load sales data from the backend API

  useEffect(() => {

    fetchData();

  }, [user, token, toast]);



  const applyFilters = () => {

    let data = allSalesData;

    if (dateRange.from && dateRange.to) {

      data = data.filter(item => new Date(item.date) >= dateRange.from && new Date(item.date) <= dateRange.to);

    }

    if (selectedProduct !== t('allProducts')) data = data.filter(item => item.product === selectedProduct);

    if (selectedCustomer !== t('allCustomers')) data = data.filter(item => item.customer === selectedCustomer);

    if (selectedSupplier !== t('allSuppliers')) data = data.filter(item => item.supplier === selectedSupplier);

    

    // Apply corrupt data filter

    if (hideCorruptData) {

      data = data.filter(item => !item.hasNegativeTotal);

    }

    

    setFilteredData(data);

    toast({ title: t('filterApplied'), description: t('reportUpdated') });

  };



  const profitLossData = useMemo(() => {

    // Filter out transactions with unknown products for statistics calculation

    const validData = filteredData.filter(item => !item.hasUnknownProduct);

    

    const dailyData = validData.reduce((acc, sale) => {

      const day = format(new Date(sale.date), 'yyyy-MM-dd');

      if (!acc[day]) acc[day] = { name: format(new Date(day), 'EEE'), revenue: 0, cost: 0, profit: 0 };

      acc[day].revenue += sale.total;

      acc[day].cost += sale.cost * sale.quantity;

      acc[day].profit += (sale.total - (sale.cost * sale.quantity));

      return acc;

    }, {});

    return Object.values(dailyData);

  }, [filteredData]);



  const handleExport = (data, name, type) => {

    let excelData = [];

    let options = {};

    

    if (type === 'transactions') {

      // Transform data for Transactions tab export
      excelData = data.map(item => {
        // Calculate proportional discount and tax per item based on item subtotal
        const itemRatio = item.subtotal > 0 ? (item.itemSubtotal / item.subtotal) : 0;
        const itemDiscount = item.discount_amount * itemRatio;
        const itemTax = item.tax_amount * itemRatio;
        const itemTotal = item.itemSubtotal - itemDiscount + itemTax;

        return {
          'Tanggal': new Date(item.date).toLocaleString('id-ID', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }),
          'Produk': item.product,
          'Pelanggan': item.customer,
          'Supplier': item.supplier,
          'Kasir': item.cashier,
          'Jumlah': item.quantity,
          'Harga': `Rp ${item.price.toLocaleString()}`,
          'Subtotal Item': `Rp ${item.itemSubtotal.toLocaleString()}`,
          'Diskon': `Rp ${Math.round(itemDiscount).toLocaleString()}`,
          'Pajak': `Rp ${Math.round(itemTax).toLocaleString()}`,
          'Total': `Rp ${Math.round(itemTotal).toLocaleString()}`
        };
      });

      

      options = {

        sheetName: 'Laporan Transaksi',

        columnWidths: [20, 25, 20, 20, 20, 15, 15, 18, 15, 15, 18]

      };

    } else if (type === 'profitloss') {

      // Transform data for Profit/Loss tab export

      const validData = data.filter(item => !item.hasUnknownProduct);

      

      excelData = validData.map(item => {

        const itemTotal = item.itemSubtotal; // Total per item (qty × price)
        const cost = item.cost * item.quantity; // Total cost per item
        const profit = itemTotal - cost; // Profit per item

        

        return {

          'Tanggal': new Date(item.date).toLocaleString('id-ID', {

            year: 'numeric',

            month: '2-digit',

            day: '2-digit',

            hour: '2-digit',

            minute: '2-digit',

            second: '2-digit'

          }),

          'Produk': item.product,

          'Pelanggan': item.customer,

          'Supplier': item.supplier,

          'Kasir': item.cashier,

          'Jumlah': item.quantity,

          'Total': `Rp ${itemTotal.toLocaleString()}`,

          'Biaya': `Rp ${cost.toLocaleString()}`,

          'Laba': `Rp ${profit.toLocaleString()}`

        };

      });

      

      options = {

        sheetName: 'Laporan Laba Rugi',

        columnWidths: [20, 25, 20, 20, 20, 15, 20, 20, 20]

      };

    } else {

      // Default export (backward compatibility)

      excelData = data.map(item => ({

        'ID Transaksi': item.id,

        'Tanggal': new Date(item.date).toLocaleString('id-ID', {

          year: 'numeric',

          month: '2-digit',

          day: '2-digit',

          hour: '2-digit',

          minute: '2-digit',

          second: '2-digit'

        }),

        'Kasir': item.cashier,

        'Total': item.total,

        'Pembayaran': item.payment_amount || 0,

        'Kembalian': item.change_amount || 0

      }));

      

      options = {

        sheetName: 'Laporan Transaksi',

        columnWidths: [20, 25, 20, 15, 15, 15]

      };

    }

    

    // Export with enhanced options

    exportToExcel(excelData, name, options);

    

    toast({ title: t('exportSuccess'), description: `${name}.xlsx ${t('hasBeenDownloaded')}` });

  };



  const toggleTransactionSelection = (saleId) => {

    const newSelected = new Set(selectedTransactions);

    if (newSelected.has(saleId)) {

      newSelected.delete(saleId);

    } else {

      newSelected.add(saleId);

    }

    setSelectedTransactions(newSelected);

  };



  const selectAllTransactions = () => {

    if (selectedTransactions.size === filteredData.length) {

      // If all are selected, deselect all

      setSelectedTransactions(new Set());

    } else {

      // Select all unique sale IDs from filtered data

      const allSaleIds = new Set(filteredData.map(item => item.saleId));

      setSelectedTransactions(allSaleIds);

    }

  };



  const deleteSelectedTransactions = async () => {

    if (selectedTransactions.size === 0) {

      toast({ title: t('noTransactionsSelected'), description: t('pleaseSelectTransactionsToDelete'), variant: 'destructive' });

      return;

    }



    if (!window.confirm(`${t('confirmDeleteTransactions')} ${selectedTransactions.size} ${t('transactions')}. ${t('thisActionWillRestoreStock')} ${t('cannotBeUndone')}`)) {

      return;

    }



    try {

      // Convert Set to Array for easier handling

      const transactionIds = Array.from(selectedTransactions);

      

      // Delete each selected transaction

      const deletePromises = transactionIds.map(id => salesAPI.delete(id, token));

      await Promise.all(deletePromises);

      

      // Refresh data after deletion

      await fetchData();

      

      // Clear selected transactions

      setSelectedTransactions(new Set());

      

      toast({ title: t('success'), description: `${transactionIds.length} ${t('transactionsSuccessfullyDeletedAndStockRestored')}` });

    } catch (error) {

      console.error('Error deleting transactions:', error);

      toast({ title: t('error'), description: `${t('failedToDeleteTransactions')}: ${error.message}`, variant: 'destructive' });

    }

  };



  // Print Invoice Handler - Modified to open dialog instead of direct print

  const handlePrintInvoice = async (item) => {

    try {

      // Load company settings to ensure they're up to date

      await loadCompanySettings();

      

      // Fetch full sale details using salesAPI.getById to ensure we have complete data with items

      const fullSaleData = await salesAPI.getById(item.saleId, token);

      

      // Set selectedSaleForPrint with the fetched sale data

      setSelectedSaleForPrint(fullSaleData);

      

      // Open print dialog

      setShowPrintDialog(true);

    } catch (error) {

      console.error('Error fetching sale details for printing:', error);

      toast({ 

        title: t('error'), 

        description: `${t('failedToLoadSaleDetails')}: ${error.message}`, 

        variant: 'destructive' 

      });

    }

  };



  // Unified print handler
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `receipt-${selectedSaleForPrint?.id || 'preview'}`,

    onBeforeGetContent: () => {
      // Set data attribute based on receipt type
      if (receiptType.startsWith('thermal')) {
        document.body.setAttribute('data-printing', 'thermal');
      } else {
        document.body.setAttribute('data-printing', 'invoice');
      }
      // Delay untuk memastikan CSS ter-inject sempurna
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 300);
      });
    },
    onAfterPrint: () => {

      // Remove data attribute after printing
      document.body.removeAttribute('data-printing');
      // Close dialog after printing

      setShowPrintDialog(false);

      setSelectedSaleForPrint(null);

    }

  });



  // Transform sale data for thermal receipt

  const transformSaleForThermal = (sale) => {

    if (!sale) return null;

    

    // Transform items to cart format

    const cart = sale.sale_items ? sale.sale_items.map(item => {

      // Get product barcode from productsMap if available

      const productId = item.product_id;

      const productBarcode = productId && productsMap[productId] ? productsMap[productId].barcode : null;

      

      return {

        id: item.product_id,

        name: item.product_name,

        barcode: item.barcode || productBarcode || '-',

        quantity: item.quantity,

        price: item.price

      };

    }) : [];

    

    // Calculate subtotal from items

    const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    

    // Calculate nominal discount and tax from percentages

    const discountPercent = sale.discount || 0;

    const taxPercent = sale.tax || 0;

    const discountAmount = subtotal * (discountPercent / 100);

    const taxableAmount = subtotal - discountAmount;

    const taxAmount = taxableAmount * (taxPercent / 100);

    

    return {

      cart,

      subtotal,

      discountPercent,

      discountAmount,

      taxPercent,

      taxAmount,

      total: sale.total_amount || 0,

      paymentAmount: sale.payment_amount || 0,

      change: sale.change_amount || 0,

      customer: {

        name: sale.customer_name || 'Umum'

      }

    };

  };



  // Transform sale data for A4 invoice

  const transformSaleForA4 = (sale) => {

    if (!sale) return null;

    

    // Transform sale_items to items format expected by InvoiceA4

    const items = sale.sale_items ? sale.sale_items.map(item => {

      // Get product barcode from productsMap if available

      const productId = item.product_id;

      const productBarcode = productId && productsMap[productId] ? productsMap[productId].barcode : null;

      

      return {

        product_name: item.product_name || 'Unknown Product',

        barcode: item.barcode || productBarcode || null,

        quantity: item.quantity || 0,

        price: item.price || 0

      };

    }) : [];

    

    // Calculate subtotal from items

    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    

    // Calculate nominal discount and tax from percentages

    const discountAmount = subtotal * ((sale.discount || 0) / 100);

    const taxableAmount = subtotal - discountAmount;

    const taxAmount = taxableAmount * ((sale.tax || 0) / 100);

    

    return {
      ...sale,
      items: items, // InvoiceA4 expects 'items', not 'sale_items'
      subtotal: subtotal,
      discount_amount: discountAmount,
      discount_percent: sale.discount || 0,
      tax_amount: taxAmount,
      tax_percent: sale.tax || 0,
      total_amount: sale.total_amount || 0,
      created_at: sale.created_at,
      customer: {
        name: sale.customer_name || 'Umum',
        address: sale.customer_address || '',
        phone: sale.customer_phone || ''
      }
    };

  };



  return (

    <>

      <Helmet>

        <title>{t('reports')} - idCashier</title>

        <meta name="description" content={t('reportsMetaDesc')} />

      </Helmet>



      <div className="space-y-4">

        <div>

          <h1 className="text-2xl font-bold mb-2">{t('reports')}</h1>

          <p className="text-muted-foreground text-sm">{t('reportsSubtitle')}</p>

        </div>



        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">

          <TabsList>

            <TabsTrigger value="overview">{t('overview')}</TabsTrigger>

            <TabsTrigger value="profitloss">{t('profitLossReport')}</TabsTrigger>

            <TabsTrigger value="transactions">{t('transactions')}</TabsTrigger>

          </TabsList>



          <TabsContent value="overview" className="space-y-4">

            <Card>

              <CardHeader>

                <CardTitle className="text-lg">{t('profitLossReport')}</CardTitle>

              </CardHeader>

              <CardContent>

                <div className="h-64">

                  <ResponsiveContainer width="100%" height="100%">

                    <BarChart data={profitLossData}>

                      <CartesianGrid strokeDasharray="3 3" />

                      <XAxis dataKey="name" />

                      <YAxis />

                      <Tooltip />

                      <Legend />

                      <Bar dataKey="revenue" fill="#10b981" name={t('revenue')} />

                      <Bar dataKey="cost" fill="#f59e0b" name={t('cost')} />

                      <Bar dataKey="profit" fill="#3b82f6" name={t('profit')} />

                    </BarChart>

                  </ResponsiveContainer>

                </div>

              </CardContent>

            </Card>



            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              <Card>

                <CardHeader className="p-4">

                  <CardTitle className="text-lg">{t('totalRevenue')}</CardTitle>

                </CardHeader>

                <CardContent className="p-4">

                  <p className="text-2xl font-bold">

                    Rp {filteredData.filter(item => !item.hasUnknownProduct).reduce((sum, item) => sum + item.total, 0).toLocaleString()}

                  </p>

                </CardContent>

              </Card>



              <Card>

                <CardHeader className="p-4">

                  <CardTitle className="text-lg">{t('totalTransactions')}</CardTitle>

                </CardHeader>

                <CardContent className="p-4">

                  <p className="text-2xl font-bold">{filteredData.length}</p>

                  {filteredData.some(item => item.hasUnknownProduct || item.hasUnknownCustomer) && (

                    <p className="text-xs text-yellow-600 mt-1">

                      {filteredData.filter(item => item.hasUnknownProduct || item.hasUnknownCustomer).length} {t('transactionsWithIncompleteData')}

                    </p>

                  )}

                </CardContent>

              </Card>



              <Card>

                <CardHeader className="p-4">

                  <CardTitle className="text-lg">{t('averageTransaction')}</CardTitle>

                </CardHeader>

                <CardContent className="p-4">

                  <p className="text-2xl font-bold">

                    Rp {filteredData.filter(item => !item.hasUnknownProduct).length > 0 ? 

                      Math.round(filteredData.filter(item => !item.hasUnknownProduct).reduce((sum, item) => sum + item.total, 0) / 

                       filteredData.filter(item => !item.hasUnknownProduct).length).toLocaleString('id-ID') : 0}

                  </p>

                </CardContent>

              </Card>

            </div>

          </TabsContent>



          <TabsContent value="profitloss" className="space-y-4">

            <Card>

              <CardHeader className="p-4">

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">

                  <CardTitle className="text-lg">{t('profitLossReport')}</CardTitle>

                  <div className="flex gap-1.5">

                    <Button size="sm" onClick={applyFilters} variant="outline">

                      <Search className="w-4 h-4 mr-2" />

                      {t('applyFilters')}

                    </Button>

                    <Button size="sm" onClick={() => handleExport(filteredData, 'profit_loss_report', 'profitloss')} variant="outline" disabled={!permissions.canExportReports}>

                      <Download className="w-4 h-4 mr-2" />

                      {t('export')}

                    </Button>

                  </div>

                </div>

              </CardHeader>

              <CardContent className="p-4 space-y-4">

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">

                  <div>

                    <Label className="text-xs">{t('dateRange')}</Label>

                    <Popover>

                      <PopoverTrigger asChild>

                        <Button

                          variant="outline"

                          size="sm"

                          className={cn("w-full justify-start text-left font-normal text-sm p-2")}

                        >

                          <CalendarIcon className="mr-2 h-4 w-4" />

                          {dateRange.from ? (

                            dateRange.to ? (

                              <>

                                {format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}

                              </>

                            ) : (

                              format(dateRange.from, "dd/MM/yyyy")

                            )

                          ) : (

                            <span className="text-xs">{t('pickDateRange')}</span>

                          )}

                        </Button>

                      </PopoverTrigger>

                      <PopoverContent className="w-auto p-0" align="start">

                        <Calendar

                          initialFocus

                          mode="range"

                          defaultMonth={dateRange.from}

                          selected={dateRange}

                          onSelect={setDateRange}

                          numberOfMonths={2}

                        />

                      </PopoverContent>

                    </Popover>

                  </div>



                  <div>

                    <Label className="text-xs">{t('product')}</Label>

                    <Select value={selectedProduct} onValueChange={setSelectedProduct}>

                      <SelectTrigger className="text-sm p-2">

                        <SelectValue placeholder={t('selectProduct')} />

                      </SelectTrigger>

                      <SelectContent>

                        {products.map((product) => (

                          <SelectItem key={product} value={product} className="text-sm">

                            {product}

                          </SelectItem>

                        ))}

                      </SelectContent>

                    </Select>

                  </div>



                  <div>

                    <Label className="text-xs">{t('customer')}</Label>

                    <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>

                      <SelectTrigger className="text-sm p-2">

                        <SelectValue placeholder={t('selectCustomer')} />

                      </SelectTrigger>

                      <SelectContent>

                        {customers.map((customer) => (

                          <SelectItem key={customer} value={customer} className="text-sm">

                            {customer}

                          </SelectItem>

                        ))}

                      </SelectContent>

                    </Select>

                  </div>



                  <div>

                    <Label className="text-xs">{t('supplier')}</Label>

                    <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>

                      <SelectTrigger className="text-sm p-2">

                        <SelectValue placeholder={t('selectSupplier')} />

                      </SelectTrigger>

                      <SelectContent>

                        {suppliers.map((supplier) => (

                          <SelectItem key={supplier} value={supplier} className="text-sm">

                            {supplier}

                          </SelectItem>

                        ))}

                      </SelectContent>

                    </Select>

                  </div>

                </div>



                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                  <Card>

                    <CardHeader className="p-4">

                      <CardTitle className="text-lg">{t('totalRevenue')}</CardTitle>

                    </CardHeader>

                    <CardContent className="p-4">

                      <p className="text-2xl font-bold">

                        Rp {filteredData.filter(item => !item.hasUnknownProduct).reduce((sum, item) => sum + item.itemSubtotal, 0).toLocaleString()}

                      </p>

                    </CardContent>

                  </Card>



                  <Card>

                    <CardHeader className="p-4">

                      <CardTitle className="text-lg">{t('totalCost')}</CardTitle>

                    </CardHeader>

                    <CardContent className="p-4">

                      <p className="text-2xl font-bold">

                        Rp {filteredData.filter(item => !item.hasUnknownProduct).reduce((sum, item) => sum + (item.cost * item.quantity), 0).toLocaleString()}

                      </p>

                    </CardContent>

                  </Card>



                  <Card>

                    <CardHeader className="p-4">

                      <CardTitle className="text-lg">{t('totalProfit')}</CardTitle>

                    </CardHeader>

                    <CardContent className="p-4">

                      <p className="text-2xl font-bold">

                        Rp {filteredData.filter(item => !item.hasUnknownProduct).reduce((sum, item) => sum + (item.itemSubtotal - (item.cost * item.quantity)), 0).toLocaleString()}

                      </p>

                    </CardContent>

                  </Card>



                  <Card>

                    <CardHeader className="p-4">

                      <CardTitle className="text-lg">{t('profitMargin')}</CardTitle>

                    </CardHeader>

                    <CardContent className="p-4">

                      <p className="text-2xl font-bold">

                        {filteredData.filter(item => !item.hasUnknownProduct).length > 0 ? 

                          ((filteredData.filter(item => !item.hasUnknownProduct).reduce((sum, item) => sum + (item.itemSubtotal - (item.cost * item.quantity)), 0) / 

                           filteredData.filter(item => !item.hasUnknownProduct).reduce((sum, item) => sum + item.itemSubtotal, 0)) * 100).toFixed(2) : 0}%

                      </p>

                    </CardContent>

                  </Card>

                </div>



                <div className="rounded-md border">

                  <div className="overflow-x-auto">

                    <table className="w-full">

                      <thead className="bg-muted">

                        <tr>

                          <th className="text-left p-2 text-xs font-medium">{t('date')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('product')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('customer')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('supplier')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('cashier')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('quantity')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('total')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('cost')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('profit')}</th>

                        </tr>

                      </thead>

                      <tbody>

                        {filteredData.filter(item => !item.hasUnknownProduct).map((item) => {

                          const itemTotal = item.itemSubtotal; // Total per item (qty × price)
                          const itemCost = item.cost * item.quantity; // Total cost per item
                          const profit = itemTotal - itemCost; // Profit per item

                          return (

                            <tr key={item.id} className="border-b hover:bg-muted/50">

                              <td className="p-2 text-sm">{item.date}</td>

                              <td className="p-2 text-sm">{item.product}</td>

                              <td className="p-2 text-sm">{item.customer}</td>

                              <td className="p-2 text-sm">{item.supplier}</td>

                              <td className="p-2 text-sm">{item.cashier}</td>

                              <td className="p-2 text-sm">{item.quantity}</td>

                              <td className="p-2 text-sm">Rp {itemTotal.toLocaleString()}</td>

                              <td className="p-2 text-sm">Rp {itemCost.toLocaleString()}</td>

                              <td className="p-2 text-sm">Rp {profit.toLocaleString()}</td>

                            </tr>

                          );

                        })}

                        {filteredData.filter(item => !item.hasUnknownProduct).length > 0 && (

                          <tr className="border-b bg-muted font-bold">

                            <td className="p-2 text-sm" colSpan="6">Total</td>

                            <td className="p-2 text-sm">

                              Rp {filteredData.filter(item => !item.hasUnknownProduct).reduce((sum, item) => sum + item.itemSubtotal, 0).toLocaleString()}

                            </td>

                            <td className="p-2 text-sm">

                              Rp {filteredData.filter(item => !item.hasUnknownProduct).reduce((sum, item) => sum + (item.cost * item.quantity), 0).toLocaleString()}

                            </td>

                            <td className="p-2 text-sm">

                              Rp {filteredData.filter(item => !item.hasUnknownProduct).reduce((sum, item) => sum + (item.itemSubtotal - (item.cost * item.quantity)), 0).toLocaleString()}

                            </td>

                          </tr>

                        )}

                      </tbody>

                    </table>

                  </div>

                </div>



                <div className="h-64">

                  <ResponsiveContainer width="100%" height="100%">

                    <LineChart data={profitLossData}>

                      <CartesianGrid strokeDasharray="3 3" />

                      <XAxis dataKey="name" />

                      <YAxis />

                      <Tooltip />

                      <Legend />

                      <Line type="monotone" dataKey="revenue" stroke="#10b981" name={t('revenue')} />

                      <Line type="monotone" dataKey="cost" stroke="#f59e0b" name={t('cost')} />

                      <Line type="monotone" dataKey="profit" stroke="#3b82f6" name={t('profit')} />

                    </LineChart>

                  </ResponsiveContainer>

                </div>

              </CardContent>

            </Card>

          </TabsContent>



          <TabsContent value="transactions" className="space-y-4">

            <Card>

              <CardHeader className="p-4">

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">

                  <CardTitle className="text-lg">{t('transactions')}</CardTitle>

                  <div className="flex gap-1.5">

                    <Button size="sm" onClick={applyFilters} variant="outline">

                      <Search className="w-4 h-4 mr-2" />

                      {t('applyFilters')}

                    </Button>

                    <Button 

                      size="sm" 

                      onClick={() => handleExport(filteredData, 'transactions_report', 'transactions')} 

                      variant="outline"

                      disabled={filteredData.length === 0 || !permissions.canExportReports}

                    >

                      <Download className="w-4 h-4 mr-2" />

                      {t('export')}

                    </Button>

                    <Button 

                      size="sm" 

                      onClick={deleteSelectedTransactions} 

                      variant="outline" 

                      disabled={selectedTransactions.size === 0 || !permissions.canDeleteTransaction}

                    >

                      <Trash2 className="w-4 h-4 mr-2" />

                      {t('deleteSelected')}

                    </Button>

                  </div>

                </div>

                

                {/* Filter options for transactions tab */}

              </CardHeader>

              <CardContent className="p-0">

                <div className="overflow-x-auto">

                  <div className="min-w-full inline-block align-middle">

                    <table className="min-w-full divide-y divide-gray-200">

                      <thead className="bg-muted">

                        <tr>

                          <th className="w-12 p-2">

                            <input

                              type="checkbox"

                              checked={selectedTransactions.size > 0 && selectedTransactions.size === new Set(filteredData.map(item => item.saleId)).size}

                              onChange={selectAllTransactions}

                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"

                            />

                          </th>

                          <th className="text-left p-2 text-xs font-medium">{t('date')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('product')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('customer')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('supplier')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('cashier')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('quantity')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('price')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('itemSubtotal')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('discount')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('tax')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('total')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('aksi')}</th>

                        </tr>

                      </thead>

                      <tbody>

                        {filteredData.map((item) => (

                          <tr 

                            key={item.id} 

                            className={`border-b hover:bg-muted/50 ${item.hasUnknownProduct || item.hasUnknownCustomer ? 'bg-yellow-50' : ''} ${item.hasNegativeTotal ? 'bg-red-100 text-red-800' : ''}`}

                          >

                            <td className="p-2">

                              <input

                                type="checkbox"

                                checked={selectedTransactions.has(item.saleId)}

                                onChange={() => toggleTransactionSelection(item.saleId)}

                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"

                              />

                            </td>

                            <td className="p-2 text-sm">{item.date}</td>

                            <td className={`p-2 text-sm ${item.hasUnknownProduct ? 'text-yellow-600 font-medium' : ''}`}>

                              {item.product}

                              {item.hasUnknownProduct && (

                                <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded">{t('incompleteData')}</span>

                              )}

                              {item.hasNegativeTotal && (

                                <span className="ml-2 text-xs bg-red-100 text-red-800 px-1 py-0.5 rounded">{t('dataCorrupt')}</span>

                              )}

                            </td>

                            <td className={`p-2 text-sm ${item.hasUnknownCustomer ? 'text-yellow-600 font-medium' : ''}`}>

                              {item.customer}

                              {item.hasUnknownCustomer && (

                                <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded">{t('incompleteData')}</span>

                              )}

                            </td>

                            <td className="p-2 text-sm">{item.supplier}</td>

                            <td className="p-2 text-sm">{item.cashier}</td>

                            <td className="p-2 text-sm">{item.quantity}</td>

                            <td className="p-2 text-sm">Rp {item.price.toLocaleString()}</td>

                            <td className="p-2 text-sm">Rp {item.itemSubtotal.toLocaleString()}</td>

                            <td className="p-2 text-sm">{item.isFirstItemInSale ? `Rp ${item.discount_amount.toLocaleString()}` : ''}</td>

                            <td className="p-2 text-sm">{item.isFirstItemInSale ? `Rp ${item.tax_amount.toLocaleString()}` : ''}</td>

                            <td className="p-2 text-sm">{item.isFirstItemInSale ? `Rp ${item.total.toLocaleString()}` : ''}</td>

                            <td className="p-2 text-sm">

                              {item.isFirstItemInSale && (

                                <Button 

                                  size="sm" 

                                  variant="outline" 

                                  onClick={() => handlePrintInvoice(item)}

                                >

                                  <Printer className="w-4 h-4" />

                                </Button>

                              )}

                            </td>

                          </tr>

                        ))}

                      </tbody>

                    </table>

                  </div>

                </div>

              </CardContent>

            </Card>

          </TabsContent>

        </Tabs>

        

        {/* Print Preview Dialog */}

        <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>

          <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">

            <DialogHeader>

              <DialogTitle>{t('receiptPreviewTitle')}</DialogTitle>

            </DialogHeader>

            

            {/* Unified receipt type selector */}
            <div className="space-y-4 mb-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="receiptType">{t('receiptType') || 'Jenis Struk'}</Label>
                <Select value={receiptType} onValueChange={setReceiptType}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Pilih jenis struk" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thermal-58mm">Thermal 58mm</SelectItem>
                    <SelectItem value="thermal-80mm">Thermal 80mm</SelectItem>
                    <SelectItem value="thermal-a4">Thermal A4</SelectItem>
                    <SelectItem value="invoice-a4">Invoice A4</SelectItem>
                  </SelectContent>
                </Select>
            </div>

            

              {/* Decimal places toggle - applies to all types */}
              <div className="flex items-center justify-between">
                <Label htmlFor="useTwoDecimals">{t('useTwoDecimals')}</Label>

                <Switch

                  id="useTwoDecimals"

                  checked={useTwoDecimals}

                  onCheckedChange={setUseTwoDecimals}

                />

              </div>

            </div>
            
            {/* Unified preview box */}
            <div className="border rounded-lg p-4 max-h-[50vh] overflow-auto bg-gray-50">
                {selectedSaleForPrint && (

                <div ref={printRef}>
                  {receiptType === 'invoice-a4' ? (
                    <div style={{ transform: 'scale(0.8)', transformOrigin: 'top left' }}>

                      <div className="printable-invoice-area">

                        <InvoiceA4 
                          sale={transformSaleForA4(selectedSaleForPrint)} 
                          companyInfo={companyInfo} 
                          useTwoDecimals={useTwoDecimals}
                          context="reports"
                        />

                      </div>

                    </div>

                  ) : (
                    <div className="receipt-printable">
                <ReceiptContent 

                  {...transformSaleForThermal(selectedSaleForPrint)}

                  settings={companyInfo}

                        paperSize={receiptType.replace('thermal-', '')}
                        useTwoDecimals={useTwoDecimals}
                  t={t}

                />

                    </div>
              )}

            </div>

              )}
            </div>
            
            {/* Single print button */}
            <Button onClick={handlePrint} className="w-full mt-4">
              <Printer className="w-4 h-4 mr-2" />
              {t('print') || 'Cetak'}
            </Button>
          </DialogContent>

        </Dialog>

      </div>

    </>

  );

};



export default ReportsPage;