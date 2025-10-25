import React, { useState, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Users, Store, Printer, Settings as SettingsIcon, Image as ImageIcon, Trash2, KeyRound, Plus, Edit } from 'lucide-react';
import PrintReceipt from '@/components/PrintReceipt';
import InvoiceA4 from '@/components/InvoiceA4';
import { supabase } from '@/lib/supabaseClient';
import { usersAPI, customersAPI } from '@/lib/api';
import { useReactToPrint } from 'react-to-print';

// 1) Tambahkan helper di atas SettingsPage
const normalizeRole = (role) => {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'admin') return 'owner';
  if (r === 'kasir') return 'cashier';
  if (r === 'owner' || r === 'cashier') return r;
  return r || 'owner';
};

const normalizeId = (id) => (id === null || id === undefined ? '' : String(id));

const extractUsersArray = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.users)) return res.users;
  if (Array.isArray(res?.results)) return res.results;
  return [];
};

const parsePermissions = (val) => {
  const defaults = {
    sales: true,
    products: true,
    reports: true,
    canEditProduct: true,
    canDeleteProduct: false,
    canAddProduct: true,
    canImportProduct: true,
    canAddCustomer: true,
    canAddSupplier: true,
    canApplyDiscount: true,
    canApplyTax: true,
    canDeleteTransaction: false,
    canExportReports: true
  };
  
  if (!val) return defaults;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return { ...defaults, ...parsed };
    } catch {
      return defaults;
    }
  }
  return { ...defaults, ...val };
};

const SettingsPage = ({ user, onUserUpdate, navigationParams }) => {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { navigateTo, clearNavigationParams } = useNavigation();
  const { toast } = useToast();
  const { user: authUser, token } = useAuth();
  const logoInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('toko');

  const [storeSettings, setStoreSettings] = useState({ name: 'Toko Kopi Senja', address: 'Jl. Kenangan No. 123', phone: '081234567890', logo: 'https://horizons-cdn.hostinger.com/d409a546-26a3-44fa-aa18-825a2b25dd23/d6d01db925de820ca92a4d792edd6c8f8f.png' });
  const [generalSettings, setGeneralSettings] = useState({ timezone: 'Asia/Jakarta', currency: 'IDR' });
  const [receiptSettings, setReceiptSettings] = useState({ headerText: '', footerText: t('receiptFooter'), showAddress: true, showPhone: true, margin: 10 });
  const [paperSize, setPaperSize] = useState('80mm');
  const [allCashiers, setAllCashiers] = useState([]);
  const [isCashierDialogOpen, setIsCashierDialogOpen] = useState(false);
  const [currentCashier, setCurrentCashier] = useState(null);
  const [newPassword, setNewPassword] = '';

  // A4 Invoice Preview States
  const invoiceA4Ref = useRef();
  
  // 2) Di dalam komponen, tambahkan state:
  const [isLoadingCashiers, setIsLoadingCashiers] = useState(false);

  // Customer management state
  const [customers, setCustomers] = useState([]);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState(null);

  // Example transaction data for preview
  const exampleTransaction = {
    cart: [{id:1, name:'Contoh Produk', price:10000, quantity:2, barcode:'12345'}],
    subtotal: 20000,
    discountAmount: 1000,
    taxAmount: 2000,
    total: 21000,
    paymentAmount: 25000,
    change: 4000,
    customer: { name: 'Pelanggan Contoh' }
  };

  // Transform the existing exampleTransaction to also work with InvoiceA4 format
  const exampleSale = {
    id: 'EXAMPLE-001',
    created_at: new Date().toISOString(),
    subtotal: exampleTransaction.subtotal,
    discount_amount: exampleTransaction.discountAmount,
    tax_amount: exampleTransaction.taxAmount,
    total_amount: exampleTransaction.total,
    payment_amount: exampleTransaction.paymentAmount,
    change_amount: exampleTransaction.change,
    customer: exampleTransaction.customer,
    items: exampleTransaction.cart.map(item => ({
      product_name: item.name,
      quantity: item.quantity,
      price: item.price
    }))
  };

  // useReactToPrint hook for A4 invoice preview
  const handlePrintInvoiceA4 = useReactToPrint({
    content: () => invoiceA4Ref.current,
    documentTitle: 'invoice-preview-idcashier'
  });

  // Handle navigation parameters
  useEffect(() => {
    if (navigationParams && navigationParams.tab) {
      setActiveTab(navigationParams.tab);
      // Clear parameters after use
      clearNavigationParams();
    }
  }, [navigationParams, clearNavigationParams]);


  // Fetch cashiers when component mounts
  useEffect(() => {
    if (!user || !user.id) return;
    
    // Fetch cashiers from the database
    fetchCashiers();
    
    // For cashier accounts, use the tenantId to get store settings
    const ownerId = user.role === 'cashier' ? user.tenantId : user.id;
    const savedStoreSettings = JSON.parse(localStorage.getItem(`idcashier_store_settings_${ownerId}`)) || 
                             { name: '', address: '', phone: '', logo: '/logo.png' }; // Default logo fallback
    setStoreSettings(savedStoreSettings);

    const savedReceiptSettings = JSON.parse(localStorage.getItem(`idcashier_receipt_settings_${ownerId}`)) || receiptSettings;
    setReceiptSettings(savedReceiptSettings);
  }, [user, authUser, token]);
  
  // Fetch customers when component mounts
  useEffect(() => {
    fetchCustomers();
  }, [authUser]);

  // 3) Ganti fungsi fetchCashiers dengan versi lebih robust:
  const fetchCashiers = async () => {
    if (!authUser || !token) return;

    const role = normalizeRole(authUser.role);
    if (role !== 'owner' && authUser.email !== 'jho.j80@gmail.com') {
      setAllCashiers([]);
      return;
    }

    setIsLoadingCashiers(true);
    try {
      const res = await usersAPI.getAll(token);
      const rawUsers = extractUsersArray(res);

      const mappedUsers = rawUsers.map(u => ({
        id: u.id ?? u.user_id ?? u.uuid ?? u._id,
        email: u.email,
        name: u.name ?? u.full_name ?? u.username ?? u.email,
        role: normalizeRole(u.role ?? u.user_role),
        tenantId: u.tenantId ?? u.tenant_id ?? u.owner_id ?? u.tenant ?? u.tenantID,
        permissions: parsePermissions(u.permissions),
      }));

      // For admin users, show all cashiers
      if (authUser.email === 'jho.j80@gmail.com') {
        const cashiers = mappedUsers.filter(u => u.role === 'cashier');
        setAllCashiers(cashiers);
      } else {
        // For owner users, only show cashiers in their tenant
        const ownerIdStr = normalizeId(authUser.id);
        const cashiers = mappedUsers.filter(u => 
          u.role === 'cashier' && normalizeId(u.tenantId) === ownerIdStr
        );
        setAllCashiers(cashiers);
      }
    } catch (error) {
      console.error('Error fetching cashiers:', error);
      toast({ title: t('error'), description: `Failed to load cashiers: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoadingCashiers(false);
    }
  };

  const fetchCustomers = async () => {
    if (!authUser) return;
    
    try {
      const customersData = await customersAPI.getAll(token);
      
      // Filter out customers with "default" in their name (case-insensitive) except for the one with id 'default'
      const filteredCustomers = customersData.filter(c => c.id === 'default' || !c.name.toLowerCase().includes('default'));
      
      setCustomers(filteredCustomers);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({ title: t('error'), description: `Failed to load customers: ${error.message}`, variant: "destructive" });
    }
  };

  const tenantCashiers = allCashiers;

  // 4) Tambahkan util isOwner untuk kondisional UI:
  const isOwner = normalizeRole(authUser?.role) === 'owner';

  const handleSaveSettings = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
    toast({ title: t('success'), description: t('settingsSavedDesc') });
  };

  const handleChangePassword = () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: t('error'), description: t('passwordMinChar'), variant: "destructive" });
      return;
    }

    if (user.email === 'demo@gmail.com') {
      toast({ title: t('accessDenied'), description: t('passwordChangeFail'), variant: "destructive" });
      return;
    }
    
    const allCustomers = JSON.parse(localStorage.getItem('idcashier_customers')) || [];
    const updatedCustomers = allCustomers.map(c => {
      if (c.email === user.email) {
        return { ...c, password: newPassword };
      }
      return c;
    });

    localStorage.setItem('idcashier_customers', JSON.stringify(updatedCustomers));
    onUserUpdate({ ...user, password: newPassword });
    setNewPassword('');
    toast({ title: t('success'), description: t('passwordChangeSuccess') });
  };
  
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check if file size is too large (more than 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast({ title: t('error'), description: t('logoTooLarge'), variant: "destructive" });
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const newSettings = {...storeSettings, logo: reader.result};
        setStoreSettings(newSettings);
        handleSaveSettings(`idcashier_store_settings_${user.id}`, newSettings);
        toast({ title: t('logoUpdated'), description: t('logoUpdatedDesc') });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    const newSettings = {...storeSettings, logo: ''};
    setStoreSettings(newSettings);
    handleSaveSettings(`idcashier_store_settings_${user.id}`, newSettings);
    toast({ title: t('logoRemoved'), description: t('logoRemovedDesc') });
  };
  
  const handleCashierSubmit = async () => {
    // Add token validation
    if (!token) {
      toast({ 
        title: t('error'), 
        description: 'Sesi Anda telah berakhir. Silakan login kembali.', 
        variant: "destructive" 
      });
      return;
    }
    
    if (!currentCashier?.email || (!currentCashier.id && !currentCashier.password)) {
        toast({ title: t('error'), description: t('emailPasswordRequired'), variant: "destructive" });
        return;
    }
    if(currentCashier.password && currentCashier.password.length < 6){
        toast({ title: t('error'), description: t('passwordMinLength'), variant: "destructive" });
        return;
    }

    try {
      if (currentCashier.id) {
        // Update existing cashier
        const userData = {
          email: currentCashier.email,
          name: currentCashier.name || currentCashier.email,
          permissions: currentCashier.permissions // Add permissions to update data
        };
        
        // Only include password if it's provided
        if (currentCashier.password) {
          userData.password = currentCashier.password;
        }
        
        await usersAPI.update(currentCashier.id, userData, token);
        toast({ title: t('success'), description: t('cashierUpdated') });
      } else {
        // Create new cashier
        const userData = {
          name: currentCashier.name || currentCashier.email,
          email: currentCashier.email,
          password: currentCashier.password,
          role: 'cashier',
          permissions: currentCashier.permissions, // Add permissions to create data
          tenant_id: authUser.id // Always use the current user's ID as tenant_id
        };
        
        await usersAPI.create(userData, token);
        toast({ title: t('success'), description: t('cashierCreated') });
      }
      
      await fetchCashiers(); // Refresh the list
      setIsCashierDialogOpen(false);
      setCurrentCashier(null);
    } catch (error) {
      console.error('Error saving cashier:', error);
      toast({ title: t('error'), description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteCashier = async (cashierId) => {
    // Add token validation
    if (!token) {
      toast({ 
        title: t('error'), 
        description: 'Sesi Anda telah berakhir. Silakan login kembali.', 
        variant: "destructive" 
      });
      return;
    }
    
    try {
      await usersAPI.delete(cashierId, token);
      await fetchCashiers(); // Refresh the list
      toast({ title: t('deleted'), description: t('cashierDeleted') });
    } catch (error) {
      console.error('Error deleting cashier:', error);
      toast({ title: t('error'), description: error.message, variant: "destructive" });
    }
  };
  
  const openCashierDialog = (cashier) => {
    const defaultPermissions = { sales: true, products: false, reports: false };
    if (cashier) {
        // Ensure permissions from existing cashier are used, with fallback to defaults
        const cashierPermissions = cashier.permissions || defaultPermissions;
        setCurrentCashier({ 
          ...cashier, 
          permissions: { 
            ...defaultPermissions, 
            ...cashierPermissions 
          } 
        });
    } else {
        setCurrentCashier({ name: '', email: '', password: '', permissions: defaultPermissions });
    }
    setIsCashierDialogOpen(true);
  };

  const handlePermissionChange = (permission, value) => {
      if(currentCashier) {
          setCurrentCashier(prev => ({...prev, permissions: {...prev.permissions, [permission]: value }}));
      }
  };

  // Customer management functions
  const handleCustomerSubmit = async () => {
    if (!currentCustomer?.name || !currentCustomer?.phone) {
      toast({ title: t('error'), description: t('namePhoneRequired'), variant: "destructive" });
      return;
    }
    
    try {
      if (currentCustomer.id) {
        // Update existing customer
        const { data, error } = await supabase
          .from('customers')
          .update({ name: currentCustomer.name, address: currentCustomer.address || null, phone: currentCustomer.phone, email: currentCustomer.email || null })
          .eq('id', currentCustomer.id)
          .select()
          .single();
        
        if (error) throw error;
        
        // Update customer in state
        setCustomers(prev => prev.map(c => c.id === currentCustomer.id ? data : c));
        toast({ title: t('success'), description: t('customerUpdated') });
      } else {
        // Add new customer
        const { data, error } = await supabase
          .from('customers')
          .insert([{ id: crypto.randomUUID(), user_id: authUser.id, ...currentCustomer }])
          .select()
          .single();
        
        if (error) throw error;
        
        // Add customer to state
        setCustomers(prev => [...prev, data]);
        toast({ title: t('success'), description: t('customerAdded') });
      }
      
      setIsCustomerDialogOpen(false);
      setCurrentCustomer(null);
    } catch (error) {
      console.error('Error saving customer:', error);
      toast({ title: t('error'), description: `Failed to save customer: ${error.message}`, variant: "destructive" });
    }
  };

  const handleDeleteCustomer = async (customerId) => {
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId);
      
      if (error) throw error;
      
      // Remove customer from state
      setCustomers(prev => prev.filter(c => c.id !== customerId));
      toast({ title: t('deleted'), description: t('customerDeleted') });
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({ title: t('error'), description: `Failed to delete customer: ${error.message}`, variant: "destructive" });
    }
  };

  const openCustomerDialog = (customer) => {
    if (customer) {
      setCurrentCustomer({ ...customer });
    } else {
      setCurrentCustomer({ name: '', phone: '', email: '' });
    }
    setIsCustomerDialogOpen(true);
  };

  // Example function showing how to use navigateTo with parameters
  const navigateToReportsWithTab = (tabName) => {
    navigateTo('reports', { activeTab: tabName });
  };

  return (
    <>
      <Helmet><title>{t('settings')} - idCashier</title></Helmet>
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold">{t('settings')}</h1><p className="text-muted-foreground">{t('settingsSubtitle')}</p></div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
            <TabsTrigger value="toko"><Store className="w-4 h-4 mr-2" />{t('store')}</TabsTrigger>
            <TabsTrigger value="akun"><Users className="w-4 h-4 mr-2" />{t('account')}</TabsTrigger>
            <TabsTrigger value="pelanggan"><Users className="w-4 h-4 mr-2" />{t('customers')}</TabsTrigger>
            <TabsTrigger value="struk"><Printer className="w-4 h-4 mr-2" />{t('receipt')}</TabsTrigger>
            <TabsTrigger value="umum"><SettingsIcon className="w-4 h-4 mr-2" />{t('general')}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="toko">
            <Card className="mt-4">
              <CardHeader><CardTitle>{t('storeSettings')}</CardTitle><CardDescription>{t('storeSettingsDesc')}</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label htmlFor="storeName">{t('storeName')}</Label><Input id="storeName" value={storeSettings.name} onChange={e => setStoreSettings({...storeSettings, name: e.target.value})} /></div>
                <div className="space-y-2"><Label htmlFor="storeAddress">{t('storeAddress')}</Label><Input id="storeAddress" value={storeSettings.address} onChange={e => setStoreSettings({...storeSettings, address: e.target.value})} /></div>
                <div className="space-y-2"><Label htmlFor="storePhone">{t('storePhone')}</Label><Input id="storePhone" value={storeSettings.phone} onChange={e => setStoreSettings({...storeSettings, phone: e.target.value})} /></div>
                <div className="space-y-2"><Label>{t('storeLogo')}</Label>
                  <div className="flex items-center gap-4">
                    {storeSettings.logo ? <img src={storeSettings.logo} alt="Logo" className="w-16 h-16 rounded-md border p-1 object-contain" /> : <div className="w-16 h-16 rounded-md border flex items-center justify-center bg-muted"><ImageIcon className="w-8 h-8 text-muted-foreground"/></div>}
                    <input type="file" ref={logoInputRef} onChange={handleLogoChange} accept="image/*" className="hidden" />
                    <Button variant="outline" onClick={() => logoInputRef.current.click()}><ImageIcon className="w-4 h-4 mr-2" /> {t('changeLogo')}</Button>
                  </div>
                </div>
                <Button onClick={() => handleSaveSettings(`idcashier_store_settings_${user.id}`, storeSettings)}>{t('saveChanges')}</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="akun">
            <Card className="mt-4">
              <CardHeader><CardTitle>{t('accountManagement')}</CardTitle><CardDescription>{t('accountManagementDesc')}</CardDescription></CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">{t('yourAccount')}</h3>
                  <div className="space-y-2"><Label htmlFor="owner-email">{t('email')}</Label><Input id="owner-email" value={user.email} disabled /></div>
                  <div className="space-y-2 mt-4"><Label htmlFor="owner-password">{t('newPassword')}</Label><Input id="owner-password" type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={user.email === 'demo@gmail.com'} /></div>
                  <Button className="mt-4" onClick={handleChangePassword} disabled={user.email === 'demo@gmail.com'}><KeyRound className="w-4 h-4 mr-2" /> {t('changePassword')}</Button>
                </div>
                <div className="p-4 border rounded-lg">
                  {/* 5) Di UI bagian "Akun" → header dan list kasir, update seperti ini: */}
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold">{t('cashierAccounts')}</h3>
                    {(isOwner || authUser.email === 'jho.j80@gmail.com') && (
                      <Button variant="outline" onClick={() => openCashierDialog(null)}>
                        <Plus className="w-4 h-4 mr-2" /> {t('addCashier')}
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {isLoadingCashiers ? (
                      <p className="text-sm text-muted-foreground text-center">{t('loading') || 'Loading...'}</p>
                    ) : (
                      <>
                        {tenantCashiers.map(c => (
                          <div key={c.id} className="flex items-center justify-between p-3 border rounded-md">
                            <div>
                              <p className="font-medium">{c.email}</p>
                              {authUser.email === 'jho.j80@gmail.com' && c.tenantId && (
                                <p className="text-sm text-muted-foreground">Tenant: {c.tenantId}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => openCashierDialog(c)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleDeleteCashier(c.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {tenantCashiers.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center">{t('noCashier')}</p>
                        )}
                      </>
                    )}
                  </div>

                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pelanggan">
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>{t('customerManagement')}</CardTitle>
                <CardDescription>{t('customerManagementDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Back to Sales button if navigationParams.returnTo === 'sales' */}
                {navigationParams && navigationParams.returnTo === 'sales' && (
                  <Button onClick={() => navigateTo('sales', { refreshCustomers: true })}>
                    {t('backToSales')}
                  </Button>
                )}
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">{t('customers')}</h3>
                  <Button onClick={() => openCustomerDialog(null)}>
                    <Plus className="w-4 h-4 mr-2" /> {t('addCustomer')}
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3">{t('name')}</th>
                        <th className="text-left p-3">{t('address')}</th>
                        <th className="text-left p-3">{t('phone')}</th>
                        <th className="text-left p-3">{t('email')}</th>
                        <th className="text-right p-3">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center p-6 text-muted-foreground">
                            {t('noCustomers')}
                          </td>
                        </tr>
                      ) : (
                        customers.map(customer => (
                          <tr key={customer.id} className="border-b hover:bg-muted/50">
                            <td className="p-3">{customer.name}</td>
                            <td className="p-3">{customer.address || '-'}</td>
                            <td className="p-3">{customer.phone}</td>
                            <td className="p-3">{customer.email || '-'}</td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={() => openCustomerDialog(customer)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleDeleteCustomer(customer.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="struk">
            <Card className="mt-4">
              <CardHeader><CardTitle>{t('receiptSettings')}</CardTitle><CardDescription>{t('receiptSettingsDesc')}</CardDescription></CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="receiptHeader">{t('headerText')}</Label><Input id="receiptHeader" value={receiptSettings.headerText} onChange={e => setReceiptSettings({...receiptSettings, headerText: e.target.value})} /></div>
                  <div className="space-y-2"><Label htmlFor="receiptFooter">{t('footerText')}</Label><Input id="receiptFooter" value={receiptSettings.footerText} onChange={e => setReceiptSettings({...receiptSettings, footerText: e.target.value})} /></div>
                  <div className="space-y-2"><Label htmlFor="receiptMargin">{t('margin')}</Label><Input id="receiptMargin" type="number" value={receiptSettings.margin} onChange={e => setReceiptSettings({...receiptSettings, margin: Number(e.target.value)})} /></div>
                  <div className="flex items-center justify-between rounded-lg border p-3"><Label>{t('showAddress')}</Label><Switch checked={receiptSettings.showAddress} onCheckedChange={v => setReceiptSettings({...receiptSettings, showAddress: v})} /></div>
                  <div className="flex items-center justify-between rounded-lg border p-3"><Label>{t('showPhone')}</Label><Switch checked={receiptSettings.showPhone} onCheckedChange={v => setReceiptSettings({...receiptSettings, showPhone: v})} /></div>
                  <Button onClick={() => handleSaveSettings(`idcashier_receipt_settings_${user.id}`, receiptSettings)}>{t('saveChanges')}</Button>
                </div>
                <div>
                  <Label>{t('receiptPreview')}</Label>
                  <Tabs value={paperSize} onValueChange={setPaperSize} className="mt-2">
                    <TabsList>
                      <TabsTrigger value="58mm">58mm</TabsTrigger>
                      <TabsTrigger value="80mm">80mm</TabsTrigger>
                      <TabsTrigger value="A4">A4</TabsTrigger>
                    </TabsList>
                    <TabsContent value="58mm">
                      <div className="mt-4 bg-gray-200 p-4 rounded-md overflow-auto">
                        <PrintReceipt {...exampleTransaction} settings={{...storeSettings, ...receiptSettings}} paperSize="58mm" />
                      </div>
                    </TabsContent>
                    <TabsContent value="80mm">
                      <div className="mt-4 bg-gray-200 p-4 rounded-md overflow-auto">
                        <PrintReceipt {...exampleTransaction} settings={{...storeSettings, ...receiptSettings}} paperSize="80mm" />
                      </div>
                    </TabsContent>
                    <TabsContent value="A4">
                      <div className="mt-4 bg-gray-200 p-4 rounded-md overflow-auto">
                        <div style={{ transform: 'scale(0.7)', transformOrigin: 'top left' }}>
                          <div className="printable-invoice-area">
                            <InvoiceA4 
                              ref={invoiceA4Ref} 
                              sale={exampleSale} 
                              companyInfo={{...storeSettings, ...receiptSettings, logoUrl: storeSettings.logo || receiptSettings.logo}} 
                            />
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <Button onClick={handlePrintInvoiceA4} className="w-full">
                          {t('printInvoice')}
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="umum">
            <Card className="mt-4">
              <CardHeader><CardTitle>{t('generalSettings')}</CardTitle><CardDescription>{t('generalSettingsDesc')}</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3"><Label>{t('darkMode')}</Label><Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} /></div>
                <div className="space-y-2"><Label>{t('language')}</Label><Select value={language} onValueChange={setLanguage}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="id">Indonesia</SelectItem><SelectItem value="zh">中文</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>{t('timezone')}</Label><Select value={generalSettings.timezone} onValueChange={v => setGeneralSettings({...generalSettings, timezone: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Asia/Jakarta">Asia/Jakarta (WIB)</SelectItem><SelectItem value="Asia/Makassar">Asia/Makassar (WITA)</SelectItem><SelectItem value="Asia/Jayapura">Asia/Jayapura (WIT)</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>{t('currency')}</Label><Select value={generalSettings.currency} onValueChange={v => setGeneralSettings({...generalSettings, currency: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="IDR">IDR (Rupiah)</SelectItem><SelectItem value="USD">USD (Dollar)</SelectItem></SelectContent></Select></div>
                <Button onClick={() => toast({ title: t('settingsSaved'), description: t('generalSettingsSaved') })}>{t('saveChanges')}</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isCashierDialogOpen} onOpenChange={setIsCashierDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{currentCashier?.id ? t('edit') : t('add')} {t('cashierAccounts')}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label htmlFor="cashier-email">{t('email')}</Label><Input id="cashier-email" value={currentCashier?.email || ''} onChange={e => setCurrentCashier({...currentCashier, email: e.target.value})} /></div>
            <div className="space-y-2"><Label htmlFor="cashier-name">{t('name')}</Label><Input id="cashier-name" value={currentCashier?.name || ''} onChange={e => setCurrentCashier({...currentCashier, name: e.target.value})} placeholder={t('name')} /></div>
            <div className="space-y-2"><Label htmlFor="cashier-password">{t('password')}</Label><Input id="cashier-password" type="password" placeholder={currentCashier?.id ? t('leaveBlank') : t('min6Chars')} onChange={e => setCurrentCashier({...currentCashier, password: e.target.value})} /></div>
            <div className="space-y-4 mt-4">
              <Label>{t('permissions')}</Label>
              <div className="flex items-center justify-between rounded-lg border p-3"><Label>{t('salesAccess')}</Label><Switch checked={currentCashier?.permissions?.sales} onCheckedChange={v => handlePermissionChange('sales', v)} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><Label>{t('productAccess')}</Label><Switch checked={currentCashier?.permissions?.products} onCheckedChange={v => handlePermissionChange('products', v)} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><Label>{t('reportAccess')}</Label><Switch checked={currentCashier?.permissions?.reports} onCheckedChange={v => handlePermissionChange('reports', v)} /></div>
              
              <Label className="text-sm font-semibold mt-4">A. {t('productsPage')}</Label>
              <div className="flex items-center justify-between rounded-lg border p-3"><Label>{t('canEditProduct')}</Label><Switch checked={currentCashier?.permissions?.canEditProduct} onCheckedChange={v => handlePermissionChange('canEditProduct', v)} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><Label>{t('canDeleteProduct')}</Label><Switch checked={currentCashier?.permissions?.canDeleteProduct} onCheckedChange={v => handlePermissionChange('canDeleteProduct', v)} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><Label>{t('canAddProduct')}</Label><Switch checked={currentCashier?.permissions?.canAddProduct} onCheckedChange={v => handlePermissionChange('canAddProduct', v)} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><Label>{t('canImportProduct')}</Label><Switch checked={currentCashier?.permissions?.canImportProduct} onCheckedChange={v => handlePermissionChange('canImportProduct', v)} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><Label>{t('canAddCustomer')}</Label><Switch checked={currentCashier?.permissions?.canAddCustomer} onCheckedChange={v => handlePermissionChange('canAddCustomer', v)} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><Label>{t('canAddSupplier')}</Label><Switch checked={currentCashier?.permissions?.canAddSupplier} onCheckedChange={v => handlePermissionChange('canAddSupplier', v)} /></div>
              
              <Label className="text-sm font-semibold mt-4">B. {t('salesPage')}</Label>
              <div className="flex items-center justify-between rounded-lg border p-3"><Label>{t('canApplyDiscount')}</Label><Switch checked={currentCashier?.permissions?.canApplyDiscount} onCheckedChange={v => handlePermissionChange('canApplyDiscount', v)} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><Label>{t('canApplyTax')}</Label><Switch checked={currentCashier?.permissions?.canApplyTax} onCheckedChange={v => handlePermissionChange('canApplyTax', v)} /></div>
              
              <Label className="text-sm font-semibold mt-4">C. {t('reportsPage')}</Label>
              <div className="flex items-center justify-between rounded-lg border p-3"><Label>{t('canDeleteTransaction')}</Label><Switch checked={currentCashier?.permissions?.canDeleteTransaction} onCheckedChange={v => handlePermissionChange('canDeleteTransaction', v)} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><Label>{t('canExportReports')}</Label><Switch checked={currentCashier?.permissions?.canExportReports} onCheckedChange={v => handlePermissionChange('canExportReports', v)} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleCashierSubmit}>{t('save')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentCustomer?.id ? t('edit') : t('add')} {t('customers')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customer-name">{t('name')}</Label>
              <Input 
                id="customer-name" 
                value={currentCustomer?.name || ''} 
                onChange={e => setCurrentCustomer({...currentCustomer, name: e.target.value})} 
                placeholder={t('customerNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-address">{t('address')}</Label>
              <Input 
                id="customer-address" 
                value={currentCustomer?.address || ''} 
                onChange={e => setCurrentCustomer({...currentCustomer, address: e.target.value})} 
                placeholder={t('address')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-phone">{t('phone')}</Label>
              <Input 
                id="customer-phone" 
                value={currentCustomer?.phone || ''} 
                onChange={e => setCurrentCustomer({...currentCustomer, phone: e.target.value})} 
                placeholder={t('phone')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-email">{t('email')}</Label>
              <Input 
                id="customer-email" 
                value={currentCustomer?.email || ''} 
                onChange={e => setCurrentCustomer({...currentCustomer, email: e.target.value})} 
                placeholder={t('emailPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCustomerSubmit}>{t('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SettingsPage;