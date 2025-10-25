import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSelector from '@/components/LanguageSelector';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import DashboardPage from '@/pages/DashboardPage';
import SalesPage from '@/pages/SalesPage';
import ProductsPage from '@/pages/ProductsPage';
import ReportsPage from '@/pages/ReportsPage';
import SettingsPage from '@/pages/SettingsPage';
import SubscriptionPage from '@/pages/SubscriptionPage';
import DeveloperPage from '@/pages/DeveloperPage';
import {
  LayoutDashboard,
  CreditCard,
  Code,
  LogOut,
  Menu,
  X,
  ShoppingCart,
  Package,
  BarChart,
  Settings,
} from 'lucide-react';

// Safe storage wrapper
const storage = {
  get(key) {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.warn(`Error reading from localStorage: ${error}`);
        return null;
      }
    }
    return null;
  },
  set(key, val) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, val);
      } catch (error) {
        console.warn(`Error writing to localStorage: ${error}`);
      }
    }
  },
  remove(key) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn(`Error removing from localStorage: ${error}`);
      }
    }
  }
};

// Helper function to resolve user role
const resolveRole = (rawRole) => {
  const r = String(rawRole || 'owner').trim().toLowerCase();
  const map = { owner: 'owner', admin: 'owner', cashier: 'cashier', kasir: 'cashier' };
  return map[r] || 'owner';
};

// Remove onLogout from props
const DashboardLayout = () => {
  const { t, language } = useLanguage();
  // Add logout function from useAuth hook
  const { user, updateUser, logout } = useAuth();
  
  // Simplified state initialization without localStorage access
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const logoUrl = "https://horizons-cdn.hostinger.com/d409a546-26a3-44fa-aa18-825a2b25dd23/d6d01db925de820ca92a4d792edd6c8f.png";

  // Hydrate currentPage from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPage = storage.get('idcashier_current_page');
      if (savedPage) {
        setCurrentPage(savedPage);
      }
    }
  }, []);

  // Set responsive default for sidebarOpen on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(min-width: 768px)');
      setSidebarOpen(mq.matches);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const role = resolveRole(user.role);

    const allMenuItems = [
      { id: 'dashboard', label: t?.('dashboard') || 'Dashboard', icon: LayoutDashboard, role: ['owner', 'cashier'] },
      { id: 'sales', label: t?.('sales') || 'Sales', icon: ShoppingCart, role: ['owner', 'cashier'] },
      { id: 'products', label: t?.('products') || 'Products', icon: Package, role: ['owner', 'cashier'] },
      { id: 'reports', label: t?.('reports') || 'Reports', icon: BarChart, role: ['owner', 'cashier'] },
      { id: 'settings', label: t?.('settings') || 'Settings', icon: Settings, role: ['owner'] },
      { id: 'subscription', label: t?.('subscription') || 'Subscription', icon: CreditCard, role: ['owner'] },
    ];

    if (user.email === 'jho.j80@gmail.com' && role === 'owner') {
      allMenuItems.push({ id: 'developer', label: t?.('developer') || 'Developer', icon: Code, role: ['owner'] });
    }

    let filtered = allMenuItems.filter(item => item.role.includes(role));

    if (role === 'cashier') {
      const perms = user.permissions;
      filtered = allMenuItems.filter(item => {
        if (!item.role.includes('cashier')) return false;
        if (item.id === 'dashboard') return true;
        if (perms && typeof perms === 'object') {
          return Boolean(perms[item.id]);
        }
        // jika tidak ada permissions, tampilkan semua menu cashier
        return true;
      });
    }

    // Pastikan dashboard selalu ada
    if (!filtered.some(i => i.id === 'dashboard')) {
      const dash = allMenuItems.find(i => i.id === 'dashboard');
      if (dash) filtered.unshift(dash);
    }

    // Remove or comment out debug console.log
    // console.log('[menu]', { role, count: filtered.length, ids: filtered.map(i => i.id) });

    setMenuItems(filtered);
  }, [t, user, language]);

  const handleNavigate = (page) => {
    storage.set('idcashier_current_page', page);
    setCurrentPage(page);
  };

  // Create helper function to handle menu clicks
  const handleMenuClick = (page) => {
    handleNavigate(page);
    // Only close sidebar on mobile devices
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const renderPageContent = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage />;
      case 'sales': return <SalesPage user={user} />;
      case 'products': return <ProductsPage user={user} />;
      case 'reports': return <ReportsPage user={user} />;
      case 'settings': return <SettingsPage user={user} onUserUpdate={updateUser} />;
      case 'subscription': return <SubscriptionPage />;
      case 'developer': return user.email === 'jho.j80@gmail.com' ? <DeveloperPage /> : <DashboardPage />;
      default: 
        handleNavigate('dashboard');
        return <DashboardPage />;
    }
  };

  const NavButton = ({ item, onClick, isActive }) => (
    <Button
      variant={isActive ? "secondary" : "ghost"}
      className="w-full justify-start text-base py-6"
      onClick={onClick}
    >
      <item.icon className="w-5 h-5 mr-4" />
      {item.label}
    </Button>
  );
  
  // Show skeleton/placeholder when user is not available
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-48 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:inline-flex"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X /> : <Menu />}
            </Button>
            <div className="flex items-center gap-2">
              <img src={logoUrl} alt="idCashier Logo" className="w-8 h-8" />
              <span className="font-bold text-xl hidden sm:inline">idCashier</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <LanguageSelector />
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => {
              storage.remove('idcashier_current_page');
              // Use logout function from AuthContext directly
              logout();
            }}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>
      
      <div className="flex">
         <aside
          className={`fixed md:sticky top-16 left-0 z-40 h-[calc(100vh-4rem)] w-64 border-r bg-card transform transition-transform ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } md:translate-x-0`}
        >
          <div className="flex flex-col h-full">
            <nav className="flex-1 space-y-2 p-4">
              {menuItems.map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  isActive={currentPage === item.id}
                  onClick={() => handleMenuClick(item.id)}
                />
              ))}
            </nav>
            <div className="p-4 border-t">
              <div className="p-4 rounded-lg bg-muted text-center">
                  <p className="text-sm font-semibold">{user.name || user.email}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-muted/30">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            {renderPageContent()}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;