import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePrintStyles } from '@/hooks/usePrintStyles';
import { useToast } from '@/components/ui/use-toast';
import { useNavigation } from '@/contexts/NavigationContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch'; // Import the Switch component
import { motion } from 'framer-motion';
import { ScanBarcode, Package, List, LayoutGrid, Ticket, DollarSign, Percent } from 'lucide-react';
import { salesAPI, productsAPI, customersAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import InvoiceA4 from '@/components/InvoiceA4';
import PrintReceipt from '@/components/PrintReceipt';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useReactToPrint } from 'react-to-print';

const SalesPage = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { navigationParams, clearNavigationParams } = useNavigation();
  const { user: authUser, token } = useAuth();
  const permissions = usePermissions();
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('grid');
  const [selectedCustomer, setSelectedCustomer] = useState('default');
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [completedSaleData, setCompletedSaleData] = useState(null);
  
  // Add Customer Dialog States
  const [isAddCustomerDialogOpen, setIsAddCustomerDialogOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '', address: '' });
  
  // A4 Invoice Printing States
  const [showInvoiceA4, setShowInvoiceA4] = useState(false);
  const [useTwoDecimals, setUseTwoDecimals] = useState(true);
  const invoiceA4Ref = useRef();
  
  // Receipt Settings
  const [receiptSettings, setReceiptSettings] = useState({
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
  });
  
  // Paper size for thermal receipt
  const [paperSize, setPaperSize] = useState('80mm');
  
  const searchInputRef = useRef(null);

  // Dynamic CSS injection - map showInvoiceA4 dan paperSize ke printType
  const getPrintType = () => {
    if (!completedSaleData) return null;
    if (showInvoiceA4) return 'invoice-a4';
    // Map paperSize ke format yang digunakan hook
    if (paperSize === '58mm') return 'thermal-58mm';
    if (paperSize === '80mm') return 'thermal-80mm';
    if (paperSize === 'A4') return 'thermal-a4';
    return null;
  };
  
  usePrintStyles(getPrintType());
  
  // Transform completedSaleData for InvoiceA4
  const transformToSaleFormat = (completedSaleData) => {
    if (!completedSaleData) return null;
    
    // Map cart array to items array with required structure
    const transformedItems = completedSaleData.cart.map(item => ({
      product_name: item.name,
      quantity: item.quantity,
      price: item.price,
      barcode: item.barcode || item.product?.barcode || item.productBarcode || '-'
    }));
    
    // Create sale object with expected structure
    const sale = {
      id: 'TEMP-' + Date.now(),
      created_at: new Date().toISOString(),
      subtotal: completedSaleData.subtotal || 0,
      discount_amount: completedSaleData.discountAmount || 0,
      discount_percent: typeof discount === 'number' ? discount : Number(discount) || 0,
      tax_amount: completedSaleData.taxAmount || 0,
      tax_percent: typeof tax === 'number' ? tax : Number(tax) || 0,
      total_amount: completedSaleData.total,
      payment_amount: completedSaleData.paymentAmount,
      change_amount: completedSaleData.change,
      customer: completedSaleData.customer,
      items: transformedItems
    };
    
    return sale;
  };
  
  // Get transformed sale data
  const transformedSale = transformToSaleFormat(completedSaleData);
  
  // useReactToPrint hook for A4 invoice
  const handlePrintInvoiceA4 = useReactToPrint({
    content: () => invoiceA4Ref.current,
    documentTitle: `invoice-idcashier-${new Date().getTime()}`,
    onBeforeGetContent: () => {
      // Delay untuk memastikan CSS ter-inject sempurna
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 300);
      });
    }
  });

  useEffect(() => {
    fetchData();
  }, [authUser]);

  // Check for navigation parameters to refresh customers
  useEffect(() => {
    if (navigationParams && navigationParams.refreshCustomers) {
      fetchData();
      clearNavigationParams();
    }
  }, [navigationParams]);

  const fetchData = async () => {
    if (!authUser || !token) return;
    
    try {
      // Fetch products from API (now with tenant-based filtering)
      const productsData = await productsAPI.getAll(token);
      setProducts(productsData || []);
      
      // Fetch customers from API (now with tenant-based filtering)
      const customersData = await customersAPI.getAll(token);
      
      // Filter out customers with "default" in their name (case-insensitive) except for the one with id 'default'
      const filteredCustomers = customersData.filter(c => c.id === 'default' || !c.name.toLowerCase().includes('default'));
      
      // Always include the default customer at the beginning
      const defaultCustomer = { id: 'default', name: t('defaultCustomer'), phone: '' };
      const allCustomers = [defaultCustomer, ...filteredCustomers];
      
      setCustomers(allCustomers);
      // Keep 'default' as selected
      setSelectedCustomer('default');
      
      // Load actual receipt settings from localStorage based on user ID
      // For cashier accounts, use the tenantId to get store settings
      const ownerId = authUser.role === 'cashier' ? authUser.tenantId : authUser.id;
      
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
      
      if (ownerId) {
        // Try to load user-specific store settings
        const savedStoreSettings = localStorage.getItem(`idcashier_store_settings_${ownerId}`);
        const savedReceiptSettings = localStorage.getItem(`idcashier_receipt_settings_${ownerId}`);
        
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
      
      setReceiptSettings(mergedSettings);
      searchInputRef.current?.focus();
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: t('error'), description: `Failed to load data: ${error.message}`, variant: "destructive" });
    }
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) {
      toast({ title: t('error'), description: t('namePhoneRequired'), variant: "destructive" });
      return;
    }
    
    try {
      const data = await customersAPI.create({
        name: newCustomer.name,
        address: newCustomer.address || null,
        phone: newCustomer.phone,
        email: newCustomer.email || null
      }, token);
      
      // Update customers list with the new customer, maintaining the default customer at the beginning
      const defaultCustomer = { id: 'default', name: t('defaultCustomer'), phone: '' };
      const updatedCustomers = [defaultCustomer, ...customers.filter(c => c.id !== 'default'), data];
      
      setCustomers(updatedCustomers);
      toast({ title: t('success'), description: t('customerAdded') });
      setNewCustomer({ name: '', phone: '' });
      setSelectedCustomer(data.id);
      setIsCustomerDialogOpen(false);
    } catch (error) {
      console.error('Error adding customer:', error);
      toast({ title: t('error'), description: `Failed to add customer: ${error.message}`, variant: "destructive" });
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleBarcodeScan = (e) => {
    if (e.key === 'Enter') {
      const product = products.find(p => p.barcode === searchTerm);
      if (product) {
        addToCart(product);
        setSearchTerm('');
        toast({ title: t('productFound'), description: `${product.name} ${t('productAddedToCart')}.` });
      } else {
        toast({ title: t('error'), description: t('productNotFound'), variant: "destructive" });
      }
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.barcode && product.barcode.includes(searchTerm))
  );

  const addToCart = (product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prevCart, { ...product, quantity: 1 }];
      }
    });
  };

  const updateQuantity = (id, quantity) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    
    setCart(prevCart =>
      prevCart.map(item => (item.id === id ? { ...item, quantity } : item))
    );
  };

  const removeFromCart = (id) => {
    setCart(prevCart => prevCart.filter(item => item.id !== id));
  };

  // Calculate cart totals
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountAmount = subtotal * (discount / 100);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * (tax / 100);
  const total = taxableAmount + taxAmount;
  const change = paymentAmount - total;
  
  // Customer for receipt (filter out default customer)
  const customerForReceipt = selectedCustomer === 'default' 
    ? null 
    : customers.find(c => c.id === selectedCustomer) || null;

  const validateStockLevels = async () => {
    // This function checks if there's enough stock for all items in the cart
    // It's called before processing payment to prevent overselling
    for (const item of cart) {
      const product = products.find(p => p.id === item.id);
      if (product && item.quantity > (product.stock || 0)) {
        throw new Error(`Stok tidak mencukupi untuk ${item.name}. Tersedia: ${product.stock || 0}, Diminta: ${item.quantity}`);
      }
    }
  };

  const handlePayment = async () => {
    // Prevent double submission
    if (isProcessingPayment) {
      return;
    }
    
    if (cart.length === 0) {
      toast({ title: t('error'), description: t('cartEmpty'), variant: "destructive" });
      return;
    }
    
    if (paymentAmount < total) {
      toast({ title: t('error'), description: t('insufficientPayment'), variant: "destructive" });
      return;
    }
    
    // Frontend validation for discount and tax
    if (discount > 100) {
      toast({ title: t('error'), description: t('maxDiscount'), variant: "destructive" });
      return;
    }
    
    if (tax < 0) {
      toast({ title: t('error'), description: t('taxNegative'), variant: "destructive" });
      return;
    }
    
    if (total <= 0) {
      toast({ title: t('error'), description: t('totalMustPositive'), variant: "destructive" });
      return;
    }
    
    // Additional client-side validations
    // Validate that all products have positive quantities
    const invalidItems = cart.filter(item => item.quantity <= 0);
    if (invalidItems.length > 0) {
      toast({ 
        title: t('error'), 
        description: t('invalidQuantity'), 
        variant: "destructive" 
      });
      return;
    }
    
    // Validate customer selection
    if (selectedCustomer !== 'default') {
      const selectedCustomerExists = customers.some(c => c.id === selectedCustomer);
      if (!selectedCustomerExists) {
        toast({ 
          title: t('error'), 
          description: t('invalidCustomerSelection'), 
          variant: "destructive" 
        });
        return;
      }
    }
    
    try {
      setIsProcessingPayment(true);
      
      // Validate stock levels before proceeding
      await validateStockLevels();
      
      // Prepare sale data
      // Handle default customer (if selectedCustomer is the default customer with id='default', set to null)
      const customerId = selectedCustomer === 'default' ? null : selectedCustomer;
      
      const saleData = {
        user_id: authUser.id, // Add the user_id to link the sale to the current user
        customer_id: customerId,
        total_amount: total,
        discount: discount,  // Changed from discountAmount to discount (percentage)
        tax: tax,            // Changed from taxAmount to tax (percentage)
        payment_amount: paymentAmount,
        change_amount: change,
        sale_items: cart.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
          price: item.price || 0
        }))
      };
      
      // Create sale using the updated API
      const result = await salesAPI.create(saleData, token);
      
      // Store completed sale data for print receipt
      setCompletedSaleData({
        cart,
        subtotal,
        discountAmount,
        taxAmount,
        total,
        paymentAmount,
        change,
        customer: customerForReceipt
      });
      
      // Show success confirmation
      toast({ 
        title: t('success'), 
        description: t('transactionSaved'), 
        variant: "success" 
      });
      
      // Refresh products to show updated stock
      fetchData();
    } catch (error) {
      console.error('Error processing sale:', error);
      
      // Show specific error messages based on error type
      let errorMessage = error.message;
      
      // Handle specific error cases
      if (errorMessage.includes('Stok tidak mencukupi')) {
        toast({ 
          title: t('insufficientStock'), 
          description: errorMessage, 
          variant: "destructive" 
        });
      } else if (errorMessage.includes('Data input tidak valid')) {
        toast({ 
          title: t('error'), 
          description: errorMessage, 
          variant: "destructive" 
        });
      } else if (errorMessage.includes('Akses tidak sah')) {
        toast({ 
          title: t('error'), 
          description: t('loginAgain'), 
          variant: "destructive" 
        });
      } else {
        toast({ 
          title: t('error'), 
          description: `${t('transactionFailed')}: ${errorMessage}`, 
          variant: "destructive" 
        });
      }
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Helper function to safely format currency values
  const formatCurrency = (value) => {
    if (value === undefined || value === null) return '0';
    return value.toLocaleString();
  };

  return (
    <>
      <Helmet>
        <title>{t('sales')} - idCashier</title>
      </Helmet>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-10rem)]">
        <div className="lg:col-span-2 flex flex-col h-full">
          <Card className="flex-shrink-0 mb-6">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full sm:w-auto flex-1">
                  <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    placeholder={t('scanOrSearch')}
                    className="pl-10"
                    value={searchTerm}
                    onChange={handleSearchChange}
                    onKeyDown={handleBarcodeScan}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setView('list')}><List className={`w-5 h-5 ${view === 'list' ? 'text-primary' : ''}`} /></Button>
                  <Button variant="outline" size="icon" onClick={() => setView('grid')}><LayoutGrid className={`w-5 h-5 ${view === 'grid' ? 'text-primary' : ''}`} /></Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="flex-1 overflow-hidden">
            <CardContent className="p-4 h-full overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">{t('noMatchingProducts')}</div>
              ) : view === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredProducts.map((product, index) => (
                    <motion.div key={product.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.05 }}>
                      <Card onClick={() => addToCart(product)} className="cursor-pointer hover:border-primary transition-all group">
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                          <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mb-2">
                            <Package className="w-8 h-8 text-muted-foreground group-hover:text-primary"/>
                          </div>
                          <p className="font-semibold text-sm">{product.name}</p>
                          <p className="text-xs text-muted-foreground">Rp {formatCurrency(product.price)}</p>
                          <p className="text-xs text-muted-foreground mt-1">{t('stockLabel')}: {product.stock || 0}</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredProducts.map(product => (
                    <div key={product.id} onClick={() => addToCart(product)} className="flex items-center p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                      <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center mr-4">
                        <Package className="w-5 h-5 text-muted-foreground"/>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{product.name}</p>
                        <p className="text-sm text-muted-foreground">{t('stockLabel')}: {product.stock || 0}</p>
                      </div>
                      <p className="font-semibold">Rp {formatCurrency(product.price)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle>{t('salesCartTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-3">
              {cart.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">{t('cartEmpty')}</div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.name}</p>
                      <p className="text-sm text-muted-foreground">Rp {formatCurrency(item.price)} x {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button variant="outline" size="sm" onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</Button>
                      <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.id)}>×</Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
            <CardContent className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="customer">{t('customer')}</Label>
                <div className="flex items-center gap-2">
                  <select 
                    id="customer"
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    className="border rounded px-2 py-1 text-sm bg-background text-foreground flex-1"
                  >
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>{customer.name}</option>
                    ))}
                  </select>
                  {permissions.canAddCustomer && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setIsAddCustomerDialogOpen(true)}
                      className="text-xs"
                    >
                      +
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center">
                <Label htmlFor="discount" className="w-20">{t('discount')}</Label>
                <Input 
                  id="discount" 
                  type="number" 
                  min="0"
                  max="100"
                  value={discount} 
                  onChange={e => {
                    const value = Number(e.target.value);
                    if (value > 100) {
                      setDiscount(100);
                      toast({ title: t('warning'), description: t('maxDiscount'), variant: "default" });
                    } else {
                      setDiscount(value);
                    }
                  }} 
                  className="flex-1 no-spin" 
                  disabled={!permissions.canApplyDiscount}
                />
                <Percent className="w-4 h-4 ml-2" />
              </div>
              <div className="flex items-center">
                <Label htmlFor="tax" className="w-20">{t('tax')}</Label>
                <Input 
                  id="tax" 
                  type="number" 
                  min="0"
                  value={tax} 
                  onChange={e => {
                    const value = Number(e.target.value);
                    if (value < 0) {
                      setTax(0);
                      toast({ title: t('warning'), description: t('taxNegative'), variant: "default" });
                    } else {
                      setTax(value);
                    }
                  }} 
                  className="flex-1 no-spin" 
                  disabled={!permissions.canApplyTax}
                />
                <Percent className="w-4 h-4 ml-2" />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>{t('subtotal')}</span>
                  <span>Rp {formatCurrency(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between">
                    <span>{t('discount')} ({discount}%)</span>
                    <span className="text-red-500">- Rp {formatCurrency(discountAmount)}</span>
                  </div>
                )}
                {tax > 0 && (
                  <div className="flex justify-between">
                    <span>{t('tax')} ({tax}%)</span>
                    <span>+ Rp {formatCurrency(taxAmount)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center text-lg font-bold border-t pt-2 mt-2">
                <span>{t('total')}</span>
                <span>Rp {formatCurrency(total)}</span>
              </div>
              <div className="flex items-center">
                <Label htmlFor="payment" className="w-20">{t('pay')}</Label>
                <Input id="payment" type="number" placeholder={t('paymentAmountPlaceholder')} value={paymentAmount || ''} onChange={e => setPaymentAmount(Number(e.target.value))} className="flex-1 no-spin" />
                <DollarSign className="w-4 h-4 ml-2" />
              </div>
              <div className="flex justify-between">
                <span>{t('change')}</span>
                <span>Rp {formatCurrency(change)}</span>
              </div>
              <Dialog onOpenChange={(open) => {
                // Only clear cart when dialog is closing and transaction was successful
                if (!open && completedSaleData) {
                  // Clear cart and reset form
                  setCart([]);
                  setDiscount(0);
                  setTax(0);
                  setPaymentAmount(0);
                  setCompletedSaleData(null);
                  // Reset invoice toggle
                  setShowInvoiceA4(false);
                }
              }}>
                <DialogTrigger asChild>
                  <Button 
                    size="lg" 
                    className="w-full text-lg h-12" 
                    disabled={cart.length === 0 || paymentAmount < total || isProcessingPayment}
                    onClick={handlePayment}
                  >
                    {isProcessingPayment ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span> {t('processing')}
                      </>
                    ) : (
                      <>
                        <Ticket className="w-5 h-5 mr-2" /> {t('payAndPrint')}
                      </>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl" aria-describedby="receipt-dialog-description">
                  <DialogHeader>
                    <DialogTitle>{t('receiptPreviewTitle')}</DialogTitle>
                  </DialogHeader>
                  
                  {/* Toggle between thermal receipt and A4 invoice */}
                  <div className="flex border-b mb-4">
                    <button
                      className={`py-2 px-4 font-medium text-sm ${!showInvoiceA4 ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
                      onClick={() => setShowInvoiceA4(false)}
                    >
                      {t('strukThermal')}
                    </button>
                    <button
                      className={`py-2 px-4 font-medium text-sm ${showInvoiceA4 ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
                      onClick={() => setShowInvoiceA4(true)}
                    >
                      {t('invoiceA4')}
                    </button>
                  </div>
                  
                  {/* Toggle for decimal places (only shown for A4 invoice) */}
                  {showInvoiceA4 && (
                    <div className="flex items-center justify-between mb-4">
                      <Label htmlFor="useTwoDecimals">{t('useTwoDecimals')}</Label>
                      <Switch
                        id="useTwoDecimals"
                        checked={useTwoDecimals}
                        onCheckedChange={setUseTwoDecimals}
                      />
                    </div>
                  )}
                  
                  {/* Conditional rendering based on toggle */}
                  {!showInvoiceA4 ? (
                    // Thermal receipt preview
                    <PrintReceipt 
                      cart={completedSaleData?.cart || cart} 
                      subtotal={completedSaleData?.subtotal || subtotal} 
                      discountAmount={completedSaleData?.discountAmount || discountAmount} 
                      taxAmount={completedSaleData?.taxAmount || taxAmount} 
                      total={completedSaleData?.total || total} 
                      paymentAmount={completedSaleData?.paymentAmount || paymentAmount} 
                      change={completedSaleData?.change || change} 
                      customer={completedSaleData?.customer || customerForReceipt} 
                      settings={receiptSettings} 
                      paperSize={paperSize} 
                      setPaperSize={setPaperSize} 
                    />
                  ) : (
                    // A4 invoice preview
                    <div className="space-y-4">
                      {transformedSale && (
                        <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
                          <div style={{ transform: 'scale(0.7)', transformOrigin: 'top left' }}>
                            <div className="printable-invoice-area">
                              <InvoiceA4 
                                sale={transformedSale} 
                                companyInfo={receiptSettings} 
                                useTwoDecimals={useTwoDecimals}
                                context="sales"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      <Button onClick={handlePrintInvoiceA4} className="w-full">
                        {t('printInvoice')}
                      </Button>
                    </div>
                  )}
                  
                  {/* Hidden invoice for printing */}
                  <div style={{ display: 'none' }}>
                    {transformedSale && (
                      <InvoiceA4 
                        ref={invoiceA4Ref} 
                        sale={transformedSale} 
                        companyInfo={receiptSettings} 
                        useTwoDecimals={useTwoDecimals}
                      />
                    )}
                  </div>
                </DialogContent>
              </Dialog>

            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Customer Dialog */}
      <Dialog open={isAddCustomerDialogOpen} onOpenChange={setIsAddCustomerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addNewCustomer')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="customer-name">{t('name')} *</Label>
              <Input
                id="customer-name"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                placeholder={t('customerName')}
              />
            </div>
            <div>
              <Label htmlFor="customer-phone">{t('phone')} *</Label>
              <Input
                id="customer-phone"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                placeholder={t('customerPhone')}
              />
            </div>
            <div>
              <Label htmlFor="customer-email">{t('email')}</Label>
              <Input
                id="customer-email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                placeholder={t('customerEmail')}
              />
            </div>
            <div>
              <Label htmlFor="customer-address">{t('address')}</Label>
              <Input
                id="customer-address"
                value={newCustomer.address}
                onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                placeholder={t('customerAddress')}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddCustomerDialogOpen(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={async () => {
                await handleAddCustomer();
                setIsAddCustomerDialogOpen(false);
              }}>
                {t('save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SalesPage;