import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, Download, Edit, Trash2 } from 'lucide-react';
import { exportToExcel } from '@/lib/utils';
import { productsAPI, categoriesAPI, suppliersAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';

const ProductsPage = ({ user }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user: authUser, token } = useAuth();
  
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]); // Will store full category objects
  const [suppliers, setSuppliers] = useState([]); // Will store full supplier objects
  
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);

  const [currentProduct, setCurrentProduct] = useState(null);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [currentSupplier, setCurrentSupplier] = useState(null);

  const isDemoAccount = user.email === 'demo@gmail.com';

  useEffect(() => {
    fetchData();
  }, [authUser]);

  const fetchData = async () => {
    if (!authUser || !token) return;
    
    try {
      // Fetch products using the API
      const productsData = await productsAPI.getAll(token);
      
      // Transform products data to include category and supplier names directly
      const transformedProducts = productsData.map(product => ({
        ...product,
        category: product.category_name || '',
        supplier: product.supplier_name || ''
      }));
      
      setProducts(transformedProducts);
      
      // Fetch categories and suppliers from backend APIs
      try {
        const categoriesData = await categoriesAPI.getAll(token);
        setCategories(categoriesData);
      } catch (error) {
        console.error('Error fetching categories:', error);
        // For demo account, if no categories exist, add some demo data
        if (isDemoAccount) {
          setCategories([
            { id: '1', name: 'Kopi', user_id: authUser.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, 
            { id: '2', name: 'Pastry', user_id: authUser.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          ]);
        } else {
          setCategories([]);
        }
      }
      
      try {
        const suppliersData = await suppliersAPI.getAll(token);
        setSuppliers(suppliersData);
      } catch (error) {
        console.error('Error fetching suppliers:', error);
        // For demo account, if no suppliers exist, add some demo data
        if (isDemoAccount) {
          setSuppliers([
            { id: '1', name: 'Supplier A', address: 'Jl. Kopi No. 1', phone: '08123456789', user_id: authUser.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, 
            { id: '2', name: 'Supplier B', address: 'Jl. Kue No. 2', phone: '08987654321', user_id: authUser.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          ]);
        } else {
          setSuppliers([]);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: t('error'), description: `${t('failedLoadData')} ${error.message}`, variant: "destructive" });
    }
  };

  const handleProductSubmit = async () => {
    if (!currentProduct.name || !currentProduct.price || !currentProduct.cost) {
      toast({ title: t('error'), description: t('priceCostRequired'), variant: "destructive" });
      return;
    }
    
    try {
      // Prepare product data with category_id and supplier_id
      const productData = {
        ...currentProduct
      };
      
      // Remove category and supplier string fields (not in DB schema)
      delete productData.category;
      delete productData.supplier;
      
      // Only include category_id if it's not null/empty
      if (currentProduct.category_id) {
        productData.category_id = currentProduct.category_id;
      } else {
        delete productData.category_id;
      }
      
      // Only include supplier_id if it's not null/empty
      if (currentProduct.supplier_id) {
        productData.supplier_id = currentProduct.supplier_id;
      } else {
        delete productData.supplier_id;
      }
      
      if (currentProduct.id) {
        // Update existing product
        await productsAPI.update(currentProduct.id, productData, token);
        toast({ title: t('success'), description: t('productUpdated') });
      } else {
        // Create new product
        await productsAPI.create(productData, token);
        toast({ title: t('success'), description: t('productAdded') });
      }
      
      setIsProductDialogOpen(false);
      setCurrentProduct(null);
      await fetchData();
    } catch (error) {
      console.error('Error saving product:', error);
      toast({ title: t('error'), description: `${t('failedSaveProduct')} ${error.message}`, variant: "destructive" });
    }
  };

  const handleEditProduct = (product) => {
    // Find category ID by name
    let categoryId = null;
    if (product.category) {
      const category = categories.find(cat => cat.name === product.category);
      if (category) {
        categoryId = category.id;
      }
    }
    
    // Find supplier ID by name
    let supplierId = null;
    if (product.supplier) {
      const supplier = suppliers.find(sup => sup.name === product.supplier);
      if (supplier) {
        supplierId = supplier.id;
      }
    }
    
    setCurrentProduct({
      ...product,
      category_id: categoryId,
      supplier_id: supplierId
    });
    setIsProductDialogOpen(true);
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm(t('confirmDeleteProduct'))) return;
    
    try {
      await productsAPI.delete(productId, token);
      toast({ title: t('deleted'), description: t('productDeleted') });
      await fetchData();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({ title: t('error'), description: `${t('failedDeleteProduct')} ${error.message}`, variant: "destructive" });
    }
  };

  const handleAddProduct = () => {
    setCurrentProduct({
      name: '',
      category_id: null,
      supplier_id: null,
      price: '',
      cost: '',
      stock: 0,
      barcode: ''
    });
    setIsProductDialogOpen(true);
  };

  // Helper function to get or create category
  const getOrCreateCategory = async (categoryName, token) => {
    try {
      // Check if category already exists in local state
      const existingCategory = categories.find(cat => cat.name === categoryName);
      if (existingCategory) {
        return existingCategory.id;
      }
      
      // Create new category if not found
      const newCategory = await categoriesAPI.create({ name: categoryName }, token);
      // Refresh categories to include the new one
      await fetchData();
      return newCategory.id;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  };

  // Helper function to get or create supplier
  const getOrCreateSupplier = async (supplierName, token) => {
    try {
      // Check if supplier already exists in local state
      const existingSupplier = suppliers.find(sup => sup.name === supplierName);
      if (existingSupplier) {
        return existingSupplier.id;
      }
      
      // Create new supplier if not found
      const newSupplier = await suppliersAPI.create({ 
        name: supplierName,
        address: '',
        phone: ''
      }, token);
      // Refresh suppliers to include the new one
      await fetchData();
      return newSupplier.id;
    } catch (error) {
      console.error('Error creating supplier:', error);
      throw error;
    }
  };

  // Function to import products from Excel
  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Process imported data with Promise.all to wait for all operations
        let successCount = 0;
        let errorCount = 0;
        
        const importPromises = jsonData.map(async (item) => {
          try {
            // Enhanced column mapping to support both Indonesian and English column names
            const name = item.Nama || item.nama || item.name || item.Name || '';
            const barcode = item.Barcode || item.barcode || '';
            const categoryName = item.Kategori || item.kategori || item.category || item.Category || '';
            const supplierName = item.Supplier || item.supplier || '';
            const price = item['Harga Jual'] || item.price || item.Price || 0;
            const cost = item['Harga Modal'] || item.cost || item.Cost || 0;
            const stock = item.Stock || item.stock || 0;
            
            // Get or create category
            let categoryId = null;
            if (categoryName) {
              categoryId = await getOrCreateCategory(categoryName, token);
            }
            
            // Get or create supplier
            let supplierId = null;
            if (supplierName) {
              supplierId = await getOrCreateSupplier(supplierName, token);
            }
            
            // Create product
            await productsAPI.create({
              name: name,
              category_id: categoryId,
              supplier_id: supplierId,
              price: parseFloat(price),
              cost: parseFloat(cost),
              stock: parseInt(stock),
              barcode: barcode
            }, token);
            
            successCount++;
            return { success: true };
          } catch (error) {
            console.error('Error importing product:', error);
            errorCount++;
            return { success: false, error: error.message };
          }
        });
        
        // Wait for all import operations to complete
        await Promise.all(importPromises);
        
        // Show result message
        if (errorCount === 0) {
          toast({ title: t('imported'), description: t('importSuccess') });
        } else {
          toast({ 
            title: t('imported'), 
            description: `${successCount} produk berhasil diimpor, ${errorCount} gagal.` 
          });
        }
        
        // Refresh all data
        await fetchData();
      } catch (error) {
        console.error('Error reading Excel file:', error);
        toast({ title: t('error'), description: t('failedReadExcel'), variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Function to export products to Excel
  const handleExport = () => {
    // Transform products data to include only required columns in the specified order
    const exportData = products.map(product => ({
      'Nama': product.name,
      'Barcode': product.barcode || '',
      'Kategori': product.category,
      'Supplier': product.supplier || '',
      'Harga Jual': product.price,
      'Harga Modal': product.cost,
      'Stock': product.stock
    }));
    
    exportToExcel(exportData, 'products');
    toast({ title: t('exported'), description: t('exportSuccess') });
  };

  // Generic delete function for product, category, or supplier
  const handleDelete = async (type, id) => {
    if (type === 'product') {
      handleDeleteProduct(id);
    } else if (type === 'category') {
      try {
        await categoriesAPI.delete(id, token);
        toast({ title: t('deleted'), description: t('categoryDeleted') });
        await fetchData(); // Refresh data
      } catch (error) {
        console.error('Error deleting category:', error);
        toast({ title: t('error'), description: `${t('failedDeleteCategory')} ${error.message}`, variant: "destructive" });
      }
    } else if (type === 'supplier') {
      try {
        await suppliersAPI.delete(id, token);
        toast({ title: t('deleted'), description: t('supplierDeleted') });
        await fetchData(); // Refresh data
      } catch (error) {
        console.error('Error deleting supplier:', error);
        toast({ title: t('error'), description: `${t('failedDeleteSupplier')} ${error.message}`, variant: "destructive" });
      }
    }
  };

  // Function to handle category submission (create/update)
  const handleCategorySubmit = async () => {
    if (!currentCategory.name) {
      toast({ title: t('error'), description: t('categoryRequired'), variant: "destructive" });
      return;
    }

    try {
      if (currentCategory.id) {
        // Update existing category
        await categoriesAPI.update(currentCategory.id, { name: currentCategory.name }, token);
        toast({ title: t('success'), description: t('categoryUpdated') });
      } else {
        // Create new category
        await categoriesAPI.create({ name: currentCategory.name }, token);
        toast({ title: t('success'), description: t('categoryAdded') });
      }

      setIsCategoryDialogOpen(false);
      setCurrentCategory(null);
      await fetchData(); // Refresh data
    } catch (error) {
      console.error('Error saving category:', error);
      toast({ title: t('error'), description: `${t('failedSaveCategory')} ${error.message}`, variant: "destructive" });
    }
  };

  // Function to handle supplier submission (create/update)
  const handleSupplierSubmit = async () => {
    if (!currentSupplier.name) {
      toast({ title: t('error'), description: t('supplierRequired'), variant: "destructive" });
      return;
    }

    try {
      const supplierData = {
        name: currentSupplier.name,
        address: currentSupplier.address || '',
        phone: currentSupplier.phone || ''
      };

      if (currentSupplier.id) {
        // Update existing supplier
        await suppliersAPI.update(currentSupplier.id, supplierData, token);
        toast({ title: t('success'), description: t('supplierUpdated') });
      } else {
        // Create new supplier
        await suppliersAPI.create(supplierData, token);
        toast({ title: t('success'), description: t('supplierAdded') });
      }

      setIsSupplierDialogOpen(false);
      setCurrentSupplier(null);
      await fetchData(); // Refresh data
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast({ title: t('error'), description: `${t('failedSaveSupplier')} ${error.message}`, variant: "destructive" });
    }
  };

  return (
    <>
      <Helmet><title>{t('products')} - idCashier</title></Helmet>
      <div className="space-y-6">
        <Tabs defaultValue="products">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">{t('products')}</h1>
              <p className="text-muted-foreground">{t('productsSubtitle')}</p>
            </div>
            <TabsList className="grid w-full sm:w-auto grid-cols-3">
              <TabsTrigger value="products">{t('products')}</TabsTrigger>
              <TabsTrigger value="categories">{t('category')}</TabsTrigger>
              <TabsTrigger value="suppliers">{t('supplier')}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="products">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <Input placeholder={t('searchProduct')} className="max-w-sm" />
                <div className="flex gap-2">
                  <label htmlFor="import-file">
                    <Button variant="outline" asChild><span><Download className="w-4 h-4 mr-2" /> {t('import')}</span></Button>
                    <input 
                      id="import-file" 
                      type="file" 
                      accept=".xlsx,.xls" 
                      className="hidden" 
                      onChange={(e) => handleImport(e)} 
                    />
                  </label>
                  <Button variant="outline" onClick={handleExport}><Upload className="w-4 h-4 mr-2" /> {t('export')}</Button>
                  <Button onClick={handleAddProduct}><Plus className="w-4 h-4 mr-2" /> {t('addProduct')}</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="border-b"><th className="p-3 text-left">{t('productName')}</th><th className="p-3 text-left">{t('barcode')}</th><th className="p-3 text-left">{t('category')}</th><th className="p-3 text-left">{t('supplier')}</th><th className="p-3 text-left">{t('sellPrice')}</th><th className="p-3 text-left">{t('costPrice')}</th><th className="p-3 text-left">{t('stock')}</th><th className="p-3 text-left">{t('actions')}</th></tr></thead>
                    <tbody>
                      {products.map(p => (
                        <tr key={p.id} className="border-b hover:bg-muted/50">
                          <td className="p-3 font-medium">{p.name}</td><td className="p-3">{p.barcode || '-'}</td><td className="p-3">{p.category}</td><td className="p-3">{p.supplier || '-'}</td><td className="p-3">Rp {p.price.toLocaleString()}</td><td className="p-3">Rp {p.cost.toLocaleString()}</td><td className="p-3">{p.stock}</td>
                          <td className="p-3"><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setCurrentProduct(p); setIsProductDialogOpen(true); }}><Edit className="w-4 h-4" /></Button><Button size="sm" variant="destructive" onClick={() => handleDeleteProduct(p.id)}><Trash2 className="w-4 h-4" /></Button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="categories">
            <Card>
              <CardHeader className="flex-row items-center justify-between"><CardTitle>{t('categoryManagement')}</CardTitle><Button onClick={() => { setCurrentCategory({ name: '' }); setIsCategoryDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" /> {t('addCategory')}</Button></CardHeader>
              <CardContent>
                {categories.map(c => <div key={c.id} className="flex items-center justify-between p-3 border-b"><p>{c.name}</p><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setCurrentCategory(c); setIsCategoryDialogOpen(true); }}><Edit className="w-4 h-4" /></Button><Button size="sm" variant="destructive" onClick={() => handleDelete('category', c.id)}><Trash2 className="w-4 h-4" /></Button></div></div>)}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suppliers">
            <Card>
              <CardHeader className="flex-row items-center justify-between"><CardTitle>{t('supplierManagement')}</CardTitle><Button onClick={() => { setCurrentSupplier({ name: '', address: '', phone: '' }); setIsSupplierDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" /> {t('addSupplier')}</Button></CardHeader>
              <CardContent>
                {suppliers.map(s => <div key={s.id} className="flex items-center justify-between p-3 border-b"><div><p className="font-medium">{s.name}</p><p className="text-sm text-muted-foreground">{s.address} - {s.phone}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setCurrentSupplier(s); setIsSupplierDialogOpen(true); }}><Edit className="w-4 h-4" /></Button><Button size="sm" variant="destructive" onClick={() => handleDelete('supplier', s.id)}><Trash2 className="w-4 h-4" /></Button></div></div>)}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}><DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{currentProduct?.id ? t('edit') : t('add')} {t('products')}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2"><Label htmlFor="name">{t('productName')}</Label><Input id="name" value={currentProduct?.name || ''} onChange={e => setCurrentProduct({...currentProduct, name: e.target.value})} /></div>
          <div className="space-y-2"><Label htmlFor="barcode">{t('barcode')}</Label><Input id="barcode" value={currentProduct?.barcode || ''} onChange={e => setCurrentProduct({...currentProduct, barcode: e.target.value})} /></div>
          <div className="space-y-2"><Label htmlFor="category">{t('category')}</Label>
            <Select value={currentProduct?.category_id || ''} onValueChange={value => setCurrentProduct({...currentProduct, category_id: value})}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectCategory')} />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label htmlFor="supplier">{t('supplier')}</Label>
            <Select value={currentProduct?.supplier_id || ''} onValueChange={value => setCurrentProduct({...currentProduct, supplier_id: value})}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectSupplier')} />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map(supplier => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label htmlFor="price">{t('sellPrice')}</Label><Input id="price" type="number" value={currentProduct?.price || ''} onChange={e => setCurrentProduct({...currentProduct, price: Number(e.target.value)})} /></div>
          <div className="space-y-2"><Label htmlFor="cost">{t('costPrice')}</Label><Input id="cost" type="number" value={currentProduct?.cost || ''} onChange={e => setCurrentProduct({...currentProduct, cost: Number(e.target.value)})} /></div>
          <div className="space-y-2"><Label htmlFor="stock">{t('stock')}</Label><Input id="stock" type="number" value={currentProduct?.stock || ''} onChange={e => setCurrentProduct({...currentProduct, stock: Number(e.target.value)})} /></div>
        </div>
        <DialogFooter><Button onClick={handleProductSubmit}>{t('save')}</Button></DialogFooter>
      </DialogContent></Dialog>

      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}><DialogContent>
        <DialogHeader><DialogTitle>{currentCategory?.id ? t('edit') : t('add')} {t('category')}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4"><div className="space-y-2"><Label htmlFor="cat-name">{t('category')}</Label><Input id="cat-name" value={currentCategory?.name || ''} onChange={e => setCurrentCategory({...currentCategory, name: e.target.value})} /></div></div>
        <DialogFooter><Button onClick={handleCategorySubmit}>{t('save')}</Button></DialogFooter>
      </DialogContent></Dialog>

      <Dialog open={isSupplierDialogOpen} onOpenChange={setIsSupplierDialogOpen}><DialogContent>
        <DialogHeader><DialogTitle>{currentSupplier?.id ? t('edit') : t('add')} {t('supplier')}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label htmlFor="sup-name">{t('supplier')}</Label><Input id="sup-name" value={currentSupplier?.name || ''} onChange={e => setCurrentSupplier({...currentSupplier, name: e.target.value})} /></div>
            <div className="space-y-2"><Label htmlFor="sup-address">{t('address')}</Label><Input id="sup-address" value={currentSupplier?.address || ''} onChange={e => setCurrentSupplier({...currentSupplier, address: e.target.value})} /></div>
            <div className="space-y-2"><Label htmlFor="sup-phone">{t('phone')}</Label><Input id="sup-phone" value={currentSupplier?.phone || ''} onChange={e => setCurrentSupplier({...currentSupplier, phone: e.target.value})} /></div>
        </div>
        <DialogFooter><Button onClick={handleSupplierSubmit}>{t('save')}</Button></DialogFooter>
      </DialogContent></Dialog>
    </>
  );
};

export default ProductsPage;