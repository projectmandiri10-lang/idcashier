import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { authAPI } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem('idcashier_token');
        if (storedToken) {
          setToken(storedToken);
          
          // Validate token directly
          const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(storedToken);
          
          if (authError) {
            throw new Error(authError.message || 'Failed to validate token');
          }
          
          if (!authUser) {
            throw new Error('User not authenticated');
          }
          
          // Fetch user profile from users table by email with fallback for RLS issues
          let userData;
          try {
            const { data, error } = await supabase
              .from('users')
              .select('id, name, email, role, tenant_id, permissions, created_at')
              .eq('email', authUser.email)
              .single();
            
            if (error) {
              throw error;
            }
            userData = data;
          } catch (singleError) {
            // Fallback strategy for error 406 (RLS configuration issue)
            if (singleError.code === 'PGRST116') {
              console.warn('RLS issue detected: Cannot coerce to single JSON object. Attempting fallback query without .single()');
              console.log('Suggestion: Check RLS configuration. Refer to SUPABASE_RLS_VERIFICATION.md for troubleshooting.');
              
              const { data: arrayData, error: arrayError } = await supabase
                .from('users')
                .select('id, name, email, role, tenant_id, permissions, created_at')
                .eq('email', authUser.email);
              
              if (arrayError) {
                throw new Error(arrayError.message || 'Failed to get user profile via fallback');
              }
              
              if (!arrayData || arrayData.length === 0) {
                throw new Error('User not found');
              } else if (arrayData.length === 1) {
                userData = arrayData[0];
              } else {
                throw new Error('Multiple users found');
              }
            } else {
              throw singleError;
            }
          }
          
          // Ensure tenantId is properly set
          const userWithTenantId = {
            ...userData,
            tenantId: userData.tenant_id || userData.tenantId
          };
          setUser(userWithTenantId);
        }
      } catch (error) {
        console.error("Failed to initialize auth state:", error);
        
        // Specific handling for error 406 (RLS issue)
        if (error.code === 'PGRST116' || error.message.includes('Cannot coerce')) {
          console.error('RLS Configuration Issue Detected: Row Level Security may be misconfigured.');
          console.log('Admin Action Required: Check RLS policies in Supabase dashboard or run npm run verify:rls');
          console.log('Refer to SUPABASE_RLS_VERIFICATION.md for detailed troubleshooting steps.');
          // Optionally, you could set an error state here for user notification, but since no toast context, logging suffices
        }
        
        // Log whether error is from network or server
        if (error instanceof TypeError && error.message.includes('fetch')) {
          console.log("Auth initialization error source: Network connectivity issue");
        } else if (error.message === 'Authentication timeout') {
          console.log("Auth initialization error: Request timeout");
        } else {
          console.log("Auth initialization error source: Server response or invalid token");
        }
        
        // Clear invalid token
        localStorage.removeItem('idcashier_token');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const result = await authAPI.login(email, password);
      
      // Check if result.token is null and handle session retrieval
      if (result.token === null) {
        const { data: session } = await supabase.auth.getSession();
        if (session && session.access_token) {
          result.token = session.access_token;
        } else {
          throw new Error('Authentication failed: No session exists');
        }
      }
      
      if (result.token && result.user) {
        setToken(result.token);
        // Ensure tenantId is properly set
        const userWithTenantId = {
          ...result.user,
          tenantId: result.user.tenant_id || result.user.tenantId
        };
        setUser(userWithTenantId);
        localStorage.setItem('idcashier_token', result.token);
        // Clean up current page from localStorage to ensure user starts on dashboard
        localStorage.removeItem('idcashier_current_page');
        return { success: true, user: userWithTenantId };
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      // Log error detail for debugging
      console.error("Login failed:", error);
      
      // Log whether error is from network or server
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.log("Login error source: Network connectivity issue");
      } else {
        console.log("Login error source: Server response or client-side validation");
      }
      
      // Ensure error message is useful and provide fallback if undefined
      let errorMessage = 'Login failed. Please try again.';
      if (error && typeof error.message === 'string' && error.message.trim() !== '') {
        errorMessage = error.message;
      } else if (error && typeof error === 'string') {
        errorMessage = error;
      }
      
      // For network errors, suggest retry
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.log("Suggestion: Check network connection and retry login");
        errorMessage += " Please check your connection and try again.";
      }
      
      return { success: false, error: errorMessage };
    }
  };

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('idcashier_token');
    // Clean up current page from localStorage on logout
    localStorage.removeItem('idcashier_current_page');
  }, []);

  const updateUser = (updatedUserData) => {
    setUser(prevUser => ({
      ...prevUser,
      ...updatedUserData
    }));
  };

  const value = {
    user,
    token,
    login,
    logout,
    updateUser,
    isAuthenticated: !!user,
    loading,
  };

  // Comment 2: Provide clearer feedback when loading
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-48 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Memuat sesi pengguna...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};