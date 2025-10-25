import { useAuth } from '@/contexts/AuthContext';

/**
 * Custom hook for checking user permissions
 * Owners have all permissions by default
 * Cashiers have permissions based on their permissions object
 */
export const usePermissions = () => {
  const { user } = useAuth();
  
  // Owner has all permissions
  if (user?.role !== 'cashier') {
    return {
      hasPermission: () => true,
      canEditProduct: true,
      canDeleteProduct: true,
      canAddProduct: true,
      canImportProduct: true,
      canAddCustomer: true,
      canAddSupplier: true,
      canApplyDiscount: true,
      canApplyTax: true,
      canDeleteTransaction: true,
      canExportReports: true,
    };
  }
  
  // Cashier: check permissions from user object
  const permissions = user?.permissions || {};
  
  return {
    hasPermission: (key) => permissions[key] === true,
    canEditProduct: permissions.canEditProduct === true,
    canDeleteProduct: permissions.canDeleteProduct === true,
    canAddProduct: permissions.canAddProduct === true,
    canImportProduct: permissions.canImportProduct === true,
    canAddCustomer: permissions.canAddCustomer === true,
    canAddSupplier: permissions.canAddSupplier === true,
    canApplyDiscount: permissions.canApplyDiscount === true,
    canApplyTax: permissions.canApplyTax === true,
    canDeleteTransaction: permissions.canDeleteTransaction === true,
    canExportReports: permissions.canExportReports === true,
  };
};

