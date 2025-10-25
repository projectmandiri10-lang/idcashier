// API utility functions for idCashier
import { supabase } from '@/lib/supabaseClient';

// Helper function to handle API responses
const handleResponse = async (response) => {
  // Log response details for debugging
  console.log('API Response:', {
    status: response.status,
    statusText: response.statusText,
    url: response.url,
    headers: Object.fromEntries(response.headers.entries())
  });
  
  // Check if response has content
  const contentLength = response.headers.get('content-length');
  const contentType = response.headers.get('content-type');
  
  // If no content or content-length is 0, throw descriptive error
  if (contentLength === '0' || !contentLength) {
    throw new Error('Server tidak merespons dengan benar. Pastikan backend server berjalan di port 3001');
  }
  
  // If content type is not JSON, throw descriptive error
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Server tidak merespons dengan benar. Pastikan backend server berjalan di port 3001');
  }
  
  try {
    const data = await response.json();
    // Log parsed data for debugging (limited size)
    if (data && typeof data === 'object' && Object.keys(data).length <= 10) {
      console.log('Parsed response data:', data);
    } else if (Array.isArray(data) && data.length <= 5) {
      console.log('Parsed response data (first 5 items):', data.slice(0, 5));
    }
    return data;
  } catch (jsonError) {
    // Handle JSON parsing errors
    throw new Error('Server mengembalikan data yang tidak valid. Pastikan backend server berjalan dengan benar.');
  }
};

// Auth API
export const authAPI = {
  login: async (email, password) => {
    try {
      // Normalize email on client side
      const normalizedEmail = email.trim().toLowerCase();
      
      // Log login attempt
      console.log(`Attempting login for: ${normalizedEmail}`);
      
      // First, try to sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: password
      });
      
      if (authError) {
        // Map Supabase errors to the expected format
        let errorMessage = 'Login failed';
        if (authError.status === 400) {
          errorMessage = 'Email atau password salah';
        } else if (authError.status === 401) {
          errorMessage = 'Email atau password salah';
        } else if (authError.status === 500) {
          errorMessage = 'Server error, silakan coba lagi';
        } else {
          errorMessage = authError.message || 'Login failed';
        }
        throw new Error(errorMessage);
      }
      
      if (!authData.session) {
        throw new Error('Login failed: session not created');
      }
      
      // Ensure the session is properly set
      if (authData.session) {
        await supabase.auth.setSession(authData.session);
      }
      
      // Add a small delay to ensure the session is properly propagated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get user profile from users table by EMAIL instead of ID
      // This solves the ID mismatch issue between Supabase Auth and database
      // Fallback strategy implemented to handle RLS configuration issues that cause error 406
      // If .single() fails with PGRST116 (406), try query without .single() and handle array result
      // This is defensive programming for RLS misconfiguration; for permanent fix, see SUPABASE_RLS_FIX.sql
      let userData;
      try {
        const result = await supabase
          .from('users')
          .select('id, name, email, role, tenant_id, permissions, created_at')
          .eq('email', normalizedEmail)  // Use email instead of ID
          .single();
        userData = result.data;
        if (result.error) {
          throw result.error;
        }
      } catch (singleError) {
        // Handle error 406 (PGRST116) with fallback strategy
        if (singleError.code === 'PGRST116') {
          console.error('Error 406 detected in login - likely RLS configuration issue:', {
            code: singleError.code,
            message: singleError.message,
            details: singleError.details,
            hint: singleError.hint
          });
          console.log('Attempting fallback query without .single() to bypass potential RLS block');
          
          // Fallback: query without .single() to get array
          const { data: userArray, error: arrayError } = await supabase
            .from('users')
            .select('id, name, email, role, tenant_id, permissions, created_at')
            .eq('email', normalizedEmail);
          
          if (arrayError) {
            console.error('Fallback query also failed:', arrayError);
            throw new Error('Failed to get user profile: ' + arrayError.message);
          }
          
          if (userArray.length === 0) {
            console.log('Fallback query returned empty array - user not found');
            throw new Error('User not found');
          } else if (userArray.length === 1) {
            console.log('Fallback query succeeded with single user');
            userData = userArray[0];
          } else {
            console.log('Fallback query returned multiple users - data inconsistency');
            throw new Error('Multiple users found');
          }
          
          console.log('RLS issue confirmed - fallback succeeded. For permanent fix, apply policies from SUPABASE_RLS_FIX.sql');
        } else {
          // Re-throw non-406 errors
          throw singleError;
        }
      }
      
      // Include tenant_id as tenantId in response
      const userResponse = {
        ...userData,
        tenantId: userData.tenant_id
      };
      
      return {
        user: userResponse,
        token: authData.session.access_token,
        message: 'Login successful'
      };
    } catch (error) {
      // Log error detail for debugging
      console.log(`Login error: ${error.message}`);
      // Re-throw other errors
      throw error;
    }
  },
  
  register: async (name, email, password, role = 'owner') => {
    try {
      // Normalize email on client side
      const normalizedEmail = email.trim().toLowerCase();
      
      // Log registration attempt
      console.log(`Attempting registration for: ${normalizedEmail}`);
      
      // First, try to sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: password,
        options: {
          data: {
            name: name,
            role: role
          }
        }
      });
      
      if (authError) {
        // Map Supabase errors to the expected format
        let errorMessage = 'Registration failed';
        if (authError.status === 400) {
          errorMessage = 'Invalid input data';
        } else if (authError.status === 409) {
          errorMessage = 'User already exists';
        } else if (authError.status === 500) {
          errorMessage = 'Server error, silakan coba lagi';
        } else {
          errorMessage = authError.message || 'Registration failed';
        }
        throw new Error(errorMessage);
      }
      
      // If user already exists but is not confirmed, authData.user will be null
      if (!authData.user) {
        throw new Error('User already exists but is not confirmed. Please check your email.');
      }
      
      // Set the auth token for subsequent requests
      if (authData.session) {
        await supabase.auth.setSession(authData.session);
      }
      
      // Add a small delay to ensure the session is properly propagated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Insert user data into users table
      const userId = authData.user.id;
      const userTenantId = role === 'owner' ? userId : null; // Will be set by admin
      
      const { data: userData, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            id: userId,
            name: name,
            email: normalizedEmail,
            role: role,
            tenant_id: userTenantId
          }
        ])
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .single();
      
      if (insertError) {
        console.error('User creation error:', {
          message: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint
        });
        throw new Error(insertError.message || 'Failed to create user profile');
      }
      
      // Include tenant_id as tenantId in response
      const userResponse = {
        ...userData,
        tenantId: userData.tenant_id
      };
      
      return {
        user: userResponse,
        token: authData.session?.access_token || null,
        message: 'User registered successfully'
      };
    } catch (error) {
      // Log error detail for debugging
      console.log(`Registration error: ${error.message}`);
      // Re-throw other errors
      throw error;
    }
  },
  
  getCurrentUser: async (token) => {
    try {
      // Log user profile request
      console.log('Fetching current user profile');
      
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Add a small delay to ensure the session is properly propagated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get user profile from users table by EMAIL instead of ID
      // This solves the ID mismatch issue between Supabase Auth and the database
      // Fallback strategy implemented to handle RLS configuration issues that cause error 406
      // If .single() fails with PGRST116 (406), try query without .single() and handle array result
      // This is defensive programming for RLS misconfiguration; for permanent fix, see SUPABASE_RLS_FIX.sql
      let userData;
      try {
        const result = await supabase
          .from('users')
          .select('id, name, email, role, tenant_id, permissions, created_at')
          .eq('email', authUser.email)  // Use email instead of ID
          .single();
        userData = result.data;
        if (result.error) {
          throw result.error;
        }
      } catch (singleError) {
        // Handle error 406 (PGRST116) with fallback strategy
        if (singleError.code === 'PGRST116') {
          console.error('Error 406 detected in getCurrentUser - likely RLS configuration issue:', {
            code: singleError.code,
            message: singleError.message,
            details: singleError.details,
            hint: singleError.hint
          });
          console.log('Attempting fallback query without .single() to bypass potential RLS block');
          
          // Fallback: query without .single() to get array
          const { data: userArray, error: arrayError } = await supabase
            .from('users')
            .select('id, name, email, role, tenant_id, permissions, created_at')
            .eq('email', authUser.email);
          
          if (arrayError) {
            console.error('Fallback query also failed:', arrayError);
            throw new Error('Failed to get user profile: ' + arrayError.message);
          }
          
          if (userArray.length === 0) {
            console.log('Fallback query returned empty array - user not found');
            throw new Error('User not found');
          } else if (userArray.length === 1) {
            console.log('Fallback query succeeded with single user');
            userData = userArray[0];
          } else {
            console.log('Fallback query returned multiple users - data inconsistency');
            throw new Error('Multiple users found');
          }
          
          console.log('RLS issue confirmed - fallback succeeded. For permanent fix, apply policies from SUPABASE_RLS_FIX.sql');
        } else {
          // Re-throw non-406 errors
          throw singleError;
        }
      }
      
      // Include tenant_id as tenantId in response
      const userResponse = {
        ...userData,
        tenantId: userData.tenant_id
      };
      
      return userResponse;
    } catch (error) {
      // Log error detail for debugging
      console.log(`Get user error: ${error.message}`);
      // Re-throw other errors
      throw error;
    }
  },
  
  requestPasswordReset: async (email) => {
    try {
      // Normalize email on client side
      const normalizedEmail = email.trim().toLowerCase();
      
      // Log password reset request
      console.log(`Requesting password reset for: ${normalizedEmail}`);
      
      // Determine redirect URL based on environment
      // Check if running on localhost/development
      const isDevelopment = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1';
      
      // Use current origin for development, configured URL for production
      const redirectUrl = isDevelopment 
        ? `${window.location.origin}/reset-password`
        : (import.meta.env.VITE_SITE_URL || 'https://idcashier.my.id') + '/reset-password';
      
      console.log('Environment:', isDevelopment ? 'Development' : 'Production');
      console.log('Using redirect URL:', redirectUrl);
      
      // Use Supabase Auth to send password reset email
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: redirectUrl
      });
      
      if (error) {
        // Map Supabase errors to the expected format
        let errorMessage = 'Failed to request password reset';
        if (error.status === 400) {
          errorMessage = 'Invalid email format';
        } else if (error.status === 500) {
          errorMessage = 'Server error, silakan coba lagi';
        } else {
          errorMessage = error.message || 'Failed to request password reset';
        }
        throw new Error(errorMessage);
      }
      
      return {
        success: true,
        message: 'If your email is registered, you will receive a password reset link shortly.'
      };
    } catch (error) {
      // Log error detail for debugging
      console.log(`Password reset request error: ${error.message}`);
      // Re-throw other errors
      throw error;
    }
  },
  
  resetPassword: async (token, password) => {
    try {
      // Log password reset attempt
      console.log('Attempting to reset password');
      
      // Update user's password using the token
      const { error } = await supabase.auth.updateUser({ password: password });
      
      if (error) {
        // Map Supabase errors to the expected format
        let errorMessage = 'Failed to reset password';
        if (error.status === 400) {
          errorMessage = 'Invalid or expired reset token';
        } else if (error.status === 500) {
          errorMessage = 'Server error, silakan coba lagi';
        } else {
          errorMessage = error.message || 'Failed to reset password';
        }
        throw new Error(errorMessage);
      }
      
      return {
        success: true,
        message: 'Password has been reset successfully.'
      };
    } catch (error) {
      // Log error detail for debugging
      console.log(`Password reset error: ${error.message}`);
      // Re-throw other errors
      throw error;
    }
  },

  updatePassword: async (password) => {
    try {
      console.log('=== UPDATE PASSWORD START ===');
      console.log('Password length:', password.length);
      
      // Check current session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log('Current session status:', sessionError ? 'ERROR' : 'OK');
      if (sessionData?.session) {
        console.log('Session user:', sessionData.session.user.email);
        console.log('Session expires at:', new Date(sessionData.session.expires_at * 1000).toLocaleString());
      } else {
        console.error('No active session found!');
        throw new Error('Session expired. Please request a new password reset link.');
      }
      
      // Update password - session recovery sudah di-set sebelumnya
      const { data, error } = await supabase.auth.updateUser({ 
        password: password 
      });
      
      if (error) {
        console.error('Update password error:', error);
        let errorMessage = 'Failed to update password';
        if (error.message && error.message.includes('session')) {
          errorMessage = 'Session expired. Please request a new password reset link.';
        } else if (error.status === 400) {
          errorMessage = 'Invalid password format. Use at least 6 characters.';
        } else {
          errorMessage = error.message || 'Failed to update password';
        }
        throw new Error(errorMessage);
      }
      
      console.log('Password updated successfully');
      console.log('=== UPDATE PASSWORD END ===');
      
      return {
        success: true,
        data,
        message: 'Password updated successfully'
      };
    } catch (error) {
      console.log(`Password update error: ${error.message}`);
      throw error;
    }
  },
}

// Products API
export const productsAPI = {
  getAll: async (token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch products for this user's tenant with related data
      // Both owner and cashier can see all products in the tenant
      let productsQuery = supabase
        .from('products')
        .select(`
          *,
          category:categories!products_category_id_fkey(name),
          supplier:suppliers!products_supplier_id_fkey(name, phone, address)
        `);

      // RLS policy "Users can view tenant products" will handle filtering automatically
      // No need to add additional filter - cashier will see owner's products via RLS

      const { data: rawData, error } = await productsQuery;
      
      if (error) {
        throw new Error(error.message || 'Failed to get products');
      }
      
      // Transform data to flatten nested relationships for backward compatibility
      const data = rawData?.map(product => ({
        ...product,
        category_name: product.category?.name || null,
        supplier_name: product.supplier?.name || null,
        supplier_phone: product.supplier?.phone || null,
        supplier_address: product.supplier?.address || null,
        cost_price: product.cost || null // Alias for ReportsPage compatibility
      })) || [];
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  getById: async (id, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch product by ID for this user's tenant using the database user ID
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to get product');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  create: async (productData, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Add user_id to product data using the database user ID
      const productWithUser = {
        ...productData,
        user_id: userData.id, // Use database user ID instead of Supabase Auth user ID
        id: crypto.randomUUID() // Generate UUID for the product
      };
      
      // Create product
      const { data, error } = await supabase
        .from('products')
        .insert([productWithUser])
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to create product');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  update: async (id, productData, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Update product using the database user ID
      const { data, error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to update product');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  delete: async (id, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Delete product using the database user ID
      const { data, error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to delete product');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
}

// Sales API
export const salesAPI = {
  getAll: async (token) => {
    try {
      // Log request for debugging
      console.log('Fetching all sales data');
      
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch sales for this user's tenant with related data
      // Join with users, customers, and get sale_items with products
      // Both owner and cashier can see all tenant sales
      let salesQuery = supabase
        .from('sales')
        .select(`
          *,
          user:users!sales_user_id_fkey(name, email),
          customer:customers!sales_customer_id_fkey(name, email, phone),
          sale_items(
            *,
            product:products!sale_items_product_id_fkey(
              name,
              barcode,
              price,
              cost,
              supplier:suppliers!products_supplier_id_fkey(name)
            )
          )
        `);

      // RLS policy "Users can view tenant sales" will handle filtering automatically
      // Both owner and cashier will see all sales in the tenant via RLS

      const { data: rawData, error } = await salesQuery.order('created_at', { ascending: false });
      
      // Transform data to flatten nested relationships for backward compatibility
      const data = rawData?.map(sale => {
        // Determine customer name:
        // - If customer_id is null (walk-in customer) → Set to "Umum"
        // - If customer_id exists but customer is deleted → Set to null (will show "Unknown Customer")
        let customerName = null;
        if (sale.customer_id === null) {
          // Walk-in customer (no customer_id specified)
          customerName = 'Umum';
        } else if (sale.customer?.name) {
          // Customer exists and has name
          customerName = sale.customer.name;
        }
        // else: customer_id exists but customer deleted → customerName stays null
        
        return {
          ...sale,
          user_name: sale.user?.name || null,
          user_email: sale.user?.email || null,
          customer_name: customerName,
          customer_email: sale.customer?.email || null,
          customer_phone: sale.customer?.phone || null,
          sale_items: sale.sale_items?.map(item => ({
            ...item,
            product_name: item.product?.name || null,
            barcode: item.product?.barcode || null,
            product_price: item.product?.price || null,
            product_cost: item.product?.cost || null,
            supplier_name: item.product?.supplier?.name || null
          })) || []
        };
      }) || [];
      
      // Log response data for debugging (limited to first 3 items to avoid huge logs)
      console.log('Sales fetch response data (first 3 items):', JSON.stringify(data.slice(0, 3), null, 2));
      
      if (error) {
        // Create more descriptive error messages based on error content
        let errorMessage = 'Failed to get sales';
        
        // Handle specific error cases
        if (error.message && error.message.includes('pembayaran')) {
          errorMessage = error.message;
        } else if (error.message && error.message.includes('Invalid input')) {
          errorMessage = 'Data input tidak valid. Periksa kembali data yang dimasukkan.';
        } else {
          errorMessage = error.message || 'Gagal mengambil data penjualan.';
        }
        
        throw new Error(errorMessage);
      }
      
      return data;
    } catch (error) {
      // Log error for debugging
      console.error('Sales fetch error:', error);
      
      // Re-throw other errors with better formatting
      throw error;
    }
  },
  
  getById: async (id, token) => {
    try {
      // Log request for debugging
      console.log('Fetching sale data with ID:', id);
      
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch sale by ID for this user's tenant with related data
      const { data: rawData, error } = await supabase
        .from('sales')
        .select(`
          *,
          user:users!sales_user_id_fkey(name, email),
          customer:customers!sales_customer_id_fkey(name, email, phone),
          sale_items(
            *,
            product:products!sale_items_product_id_fkey(
              name,
              barcode,
              price,
              cost,
              supplier:suppliers!products_supplier_id_fkey(name)
            )
          )
        `)
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .single();
      
      // Transform data to flatten nested relationships for backward compatibility
      const data = rawData ? (() => {
        // Determine customer name:
        // - If customer_id is null (walk-in customer) → Set to "Umum"
        // - If customer_id exists but customer is deleted → Set to null (will show "Unknown Customer")
        let customerName = null;
        if (rawData.customer_id === null) {
          // Walk-in customer (no customer_id specified)
          customerName = 'Umum';
        } else if (rawData.customer?.name) {
          // Customer exists and has name
          customerName = rawData.customer.name;
        }
        // else: customer_id exists but customer deleted → customerName stays null
        
        return {
          ...rawData,
          user_name: rawData.user?.name || null,
          user_email: rawData.user?.email || null,
          customer_name: customerName,
          customer_email: rawData.customer?.email || null,
          customer_phone: rawData.customer?.phone || null,
          sale_items: rawData.sale_items?.map(item => ({
            ...item,
            product_name: item.product?.name || null,
            barcode: item.product?.barcode || null,
            product_price: item.product?.price || null,
            product_cost: item.product?.cost || null,
            supplier_name: item.product?.supplier?.name || null
          })) || []
        };
      })() : null;
      
      // Log response data for debugging
      console.log('Sale fetch response data:', JSON.stringify(data, null, 2));
      
      if (error) {
        // Create more descriptive error messages based on error content
        let errorMessage = 'Failed to get sale';
        
        // Handle specific error cases
        if (error.message && error.message.includes('pembayaran')) {
          errorMessage = error.message;
        } else if (error.message && error.message.includes('Invalid input')) {
          errorMessage = 'Data input tidak valid. Periksa kembali data yang dimasukkan.';
        } else {
          errorMessage = error.message || 'Gagal mengambil data penjualan.';
        }
        
        throw new Error(errorMessage);
      }
      
      return data;
    } catch (error) {
      // Log error for debugging
      console.error('Sale fetch error:', error);
      
      // Re-throw other errors with better formatting
      throw error;
    }
  },
  
  create: async (saleData, token) => {
    try {
      // Log request payload for debugging
      console.log('Creating sale with data:', JSON.stringify(saleData, null, 2));
      
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Generate UUIDs for sale and sale items
      const saleId = crypto.randomUUID();
      
      // Add user_id to sale data using the database user ID
      const saleWithUser = {
        ...saleData,
        id: saleId,
        user_id: userData.id // Use database user ID instead of Supabase Auth user ID
      };
      
      // Remove sale_items from the sale object (it's a separate table)
      delete saleWithUser.sale_items;
      
      // Process sale items
      const saleItems = saleData.sale_items.map(item => ({
        ...item,
        id: crypto.randomUUID(),
        sale_id: saleId
      }));
      
      // Create sale in a transaction
      const { data, error } = await supabase
        .from('sales')
        .insert([saleWithUser])
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to create sale');
      }
      
      // Create sale items
      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);
      
      if (itemsError) {
        throw new Error(itemsError.message || 'Failed to create sale items');
      }
      
      // Return the complete sale with items
      const { data: completeSale, error: fetchError } = await supabase
        .from('sales')
        .select(`
          *,
          sale_items(*)
        `)
        .eq('id', saleId)
        .single();
      
      if (fetchError) {
        throw new Error(fetchError.message || 'Failed to fetch created sale');
      }
      
      // Log response data for debugging
      console.log('Sale creation response data:', JSON.stringify(completeSale, null, 2));
      
      return completeSale;
    } catch (error) {
      // Log error for debugging
      console.error('Sale creation error:', error);
      
      // Re-throw other errors with better formatting
      throw error;
    }
  },

  delete: async (id, token) => {
    try {
      // Log delete request for debugging
      console.log('Deleting sale with ID:', id);
      
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Delete sale items first (due to foreign key constraint)
      const { error: itemsError } = await supabase
        .from('sale_items')
        .delete()
        .eq('sale_id', id);
      
      if (itemsError) {
        throw new Error(itemsError.message || 'Failed to delete sale items');
      }
      
      // Delete sale using the database user ID
      const { data, error } = await supabase
        .from('sales')
        .delete()
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .select()
        .single();
      
      // Log response data for debugging
      console.log('Sale deletion response data:', JSON.stringify(data, null, 2));
      
      if (error) {
        // Create more descriptive error messages based on error content
        let errorMessage = 'Failed to delete sale';
        
        // Handle specific error cases
        if (error.message && error.message.includes('Invalid input')) {
          errorMessage = 'Data input tidak valid.';
        } else {
          errorMessage = error.message || 'Gagal menghapus penjualan.';
        }
        
        throw new Error(errorMessage);
      }
      
      return data;
    } catch (error) {
      // Log error for debugging
      console.error('Sale deletion error:', error);
      
      // Re-throw other errors with better formatting
      throw error;
    }
  },

}

// Users API
export const usersAPI = {
  getAll: async (token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch users for this user's tenant using the database user ID
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', userData.id); // Use database user ID instead of Supabase Auth user ID
      
      if (error) {
        throw new Error(error.message || 'Failed to get users');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  getById: async (id, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch user by ID for this user's tenant using the database user ID
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to get user');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  create: async (newUserData, token) => {
    try {
      // Call the auth-register Edge Function to create user in both auth.users and public.users
      const { data, error } = await supabase.functions.invoke('auth-register', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: {
          name: newUserData.name,
          email: newUserData.email,
          password: newUserData.password,
          role: newUserData.role || 'cashier',
          tenant_id: newUserData.tenant_id,
          permissions: newUserData.permissions
        }
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to create user');
      }
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      return data.user;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  update: async (id, updateData, token) => {
    try {
      // Call the users-update Edge Function which handles both public.users and auth.users updates
      const { data, error } = await supabase.functions.invoke(`users-update?id=${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: updateData
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to update user');
      }
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  delete: async (id, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Delete user using the database user ID
      const { data, error } = await supabase
        .from('users')
        .delete()
        .eq('id', id)
        .eq('tenant_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to delete user');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
}

// Categories API
export const categoriesAPI = {
  getAll: async (token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch categories for this user's tenant using the database user ID
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userData.id); // Use database user ID instead of Supabase Auth user ID
      
      if (error) {
        throw new Error(error.message || 'Failed to get categories');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  getById: async (id, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch category by ID for this user's tenant using the database user ID
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to get category');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  create: async (categoryData, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Add user_id to category data using the database user ID
      const categoryWithUser = {
        ...categoryData,
        user_id: userData.id, // Use database user ID instead of Supabase Auth user ID
        id: crypto.randomUUID() // Generate UUID for the category
      };
      
      // Create category
      const { data, error } = await supabase
        .from('categories')
        .insert([categoryWithUser])
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to create category');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  update: async (id, categoryData, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Update category using the database user ID
      const { data, error } = await supabase
        .from('categories')
        .update(categoryData)
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to update category');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  delete: async (id, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Delete category using the database user ID
      const { data, error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to delete category');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
}

// Suppliers API
export const suppliersAPI = {
  getAll: async (token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch suppliers for this user's tenant
      // Both owner and cashier can see all suppliers in the tenant
      let suppliersQuery = supabase
        .from('suppliers')
        .select('*');

      // RLS policy "Users can view tenant suppliers" will handle filtering automatically
      // Both owner and cashier will see all suppliers in the tenant via RLS

      const { data, error } = await suppliersQuery;
      
      if (error) {
        throw new Error(error.message || 'Failed to get suppliers');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  getById: async (id, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch supplier by ID for this user's tenant using the database user ID
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to get supplier');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  create: async (supplierData, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Add user_id to supplier data using the database user ID
      const supplierWithUser = {
        ...supplierData,
        user_id: userData.id, // Use database user ID instead of Supabase Auth user ID
        id: crypto.randomUUID() // Generate UUID for the supplier
      };
      
      // Create supplier
      const { data, error } = await supabase
        .from('suppliers')
        .insert([supplierWithUser])
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to create supplier');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  update: async (id, supplierData, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Update supplier using the database user ID
      const { data, error } = await supabase
        .from('suppliers')
        .update(supplierData)
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to update supplier');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  delete: async (id, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Delete supplier using the database user ID
      const { data, error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to delete supplier');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
}

// Customers API
export const customersAPI = {
  getAll: async (token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch customers for this user's tenant
      // RLS policy "Users can view tenant customers" will handle filtering automatically
      // Both owner and cashier can see all customers in the tenant via RLS
      const { data, error } = await supabase
        .from('customers')
        .select('*');
      
      if (error) {
        throw new Error(error.message || 'Failed to get customers');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  getById: async (id, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch customer by ID for this user's tenant using the database user ID
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to get customer');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  create: async (customerData, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Add user_id to customer data using the database user ID
      const customerWithUser = {
        ...customerData,
        user_id: userData.id, // Use database user ID instead of Supabase Auth user ID
        id: crypto.randomUUID() // Generate UUID for the customer
      };
      
      // Create customer
      const { data, error } = await supabase
        .from('customers')
        .insert([customerWithUser])
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to create customer');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  update: async (id, customerData, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Update customer using the database user ID
      const { data, error } = await supabase
        .from('customers')
        .update(customerData)
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to update customer');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  delete: async (id, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Delete customer using the database user ID
      const { data, error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to delete customer');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
}

// Subscription API
export const subscriptionAPI = {
  getCurrentUserSubscription: async (token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch subscription for this user using the database user ID
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .single();
      
      // Log response for debugging
      console.log('Subscription API response status:');
      
      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows returned
        throw new Error(error.message || 'Failed to get subscription');
      }
      
      console.log('Subscription data received:', data);
      return data || null;
    } catch (error) {
      // Log error for debugging
      console.error('Subscription API error:', error);
      
      // Re-throw other errors
      throw error;
    }
  },
}

export default {
  authAPI,
  productsAPI,
  salesAPI,
  usersAPI,
  categoriesAPI,
  suppliersAPI,
  customersAPI,
  subscriptionAPI
};
