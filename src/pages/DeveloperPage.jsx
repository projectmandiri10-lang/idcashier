import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const DeveloperPage = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', activePeriod: '12' });
  const [loading, setLoading] = useState(true);

  // Fetch all users with their subscription status
  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Get auth token
      const token = localStorage.getItem('idcashier_token');
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Call edge function to get all users with subscription info
      const { data, error } = await supabase.functions.invoke('subscriptions-get-all-users', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to fetch users');
      }
      
      if (data?.error) {
        throw new Error(data.error);
      }
      
      // Edge function already returns users with subscription_status, end_date, etc.
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({ title: t('error'), description: error.message || t('failedToLoadUsers'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const saveUser = async (userData) => {
    try {
      // For now, we'll just refetch all users
      await fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      toast({ title: t('error'), description: t('failedToSaveUser'), variant: 'destructive' });
    }
  };

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast({ title: t('error'), description: t('fillAllFields'), variant: 'destructive' });
      return;
    }

    try {
      // Get auth token
      const token = localStorage.getItem('idcashier_token');
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Register new user through the auth Edge Function
      const { data: authData, error: authError } = await supabase.functions.invoke('auth-register', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: {
          name: newUser.name,
          email: newUser.email,
          password: newUser.password,
          role: 'owner'
        }
      });

      if (authError) {
        throw new Error(authError.message || 'Failed to register user');
      }
      
      if (authData?.error) {
        throw new Error(authData.error);
      }
      
      // Get the newly created user ID from the response
      const newUserId = authData?.user?.id || authData?.id;
      
      if (!newUserId) {
        throw new Error('Failed to get new user ID from registration response');
      }
      
      // Convert activePeriod to number (months)
      const months = parseInt(newUser.activePeriod, 10);
      
      // Create subscription for the new user using subscriptions-update-user
      const { data: subscriptionData, error: subscriptionError } = await supabase.functions.invoke('subscriptions-update-user', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: {
          userId: newUserId,
          months: months
        }
      });

      if (subscriptionError) {
        console.error('Error creating subscription:', subscriptionError);
        toast({ title: t('warning'), description: 'User created but subscription creation failed. Please extend subscription manually.' });
      }
      
      if (subscriptionData?.error) {
        console.error('Error in subscription data:', subscriptionData.error);
        toast({ title: t('warning'), description: 'User created but subscription creation failed. Please extend subscription manually.' });
      }

      setNewUser({ name: '', email: '', password: '', activePeriod: '12' });
      await fetchUsers();
      toast({ title: t('success'), description: t('userAddedWithSubscription') || 'User added successfully with subscription' });
    } catch (error) {
      console.error('Error adding user:', error);
      toast({ title: t('error'), description: error.message || t('failedToAddUser'), variant: 'destructive' });
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      // Get auth token
      const token = localStorage.getItem('idcashier_token');
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      
      // Delete user through the users Edge Function
      const { data, error } = await supabase.functions.invoke('users-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          id: userId
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to delete user');
      }

      await fetchUsers();
      toast({ title: t('deleted'), description: t('userRemoved') });
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({ title: t('error'), description: t('failedToDeleteUser'), variant: 'destructive' });
    }
  };

  const handleExtendSubscription = async (userId) => {
    try {
      // Get auth token
      const token = localStorage.getItem('idcashier_token');
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Extend by 1 month (edge function will handle calculation from existing end_date)
      const { data, error } = await supabase.functions.invoke('subscriptions-update-user', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: {
          userId: userId,
          months: 1
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to extend subscription');
      }
      
      if (data?.error) {
        throw new Error(data.error);
      }

      await fetchUsers();
      toast({ title: t('extended') || 'Extended', description: t('subscriptionExtended') || 'Subscription extended by 1 month' });
    } catch (error) {
      console.error('Error extending subscription:', error);
      toast({ title: t('error'), description: error.message || t('failedToExtendSubscription'), variant: 'destructive' });
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return t('noData');
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch (error) {
      return dateString;
    }
  };

  return (
    <>
      <Helmet>
        <title>{t('developer')} - idCashier</title>
        <meta name="description" content={t('developerMetaDesc')} />
      </Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t('customerManagement')}</h1>
          <p className="text-muted-foreground">{t('developerSubtitle')}</p>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">{t('addCustomer')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div><Label htmlFor="name">{t('name')}</Label><Input id="name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder={t('customerNamePlaceholder')} /></div>
            <div><Label htmlFor="email">{t('email')}</Label><Input id="email" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder={t('emailPlaceholder')} /></div>
            <div><Label htmlFor="password">Password</Label><Input id="password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="••••••••" /></div>
            <div>
              <Label htmlFor="activePeriod">Masa Aktif</Label>
              <Select value={newUser.activePeriod} onValueChange={(value) => setNewUser({ ...newUser, activePeriod: value })}>
                <SelectTrigger id="activePeriod"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">{t('threeMonths')}</SelectItem>
                  <SelectItem value="6">{t('sixMonths')}</SelectItem>
                  <SelectItem value="12">{t('oneYear')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleAddUser} className="w-full md:w-auto"><Plus className="w-4 h-4 mr-2" />{t('addCustomer')}</Button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">{t('customers')}</h2>
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <p>{t('loadingUsers')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">{t('name')}</th>
                    <th className="text-left p-3">{t('email')}</th>
                    <th className="text-left p-3">{t('registeredDate')}</th>
                    <th className="text-left p-3">{t('expiryDate')}</th>
                    <th className="text-left p-3">{t('subscriptionStatus')}</th>
                    <th className="text-left p-3">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => (
                    <motion.tr key={user.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} className="border-b hover:bg-muted/50">
                      <td className="p-3 font-medium">{user.name}</td>
                      <td className="p-3">{user.email}</td>
                      <td className="p-3">{formatDate(user.start_date || user.created_at)}</td>
                      <td className="p-3">{formatDate(user.end_date)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {user.subscription_status === 'active' ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              <span className="text-green-500">{t('active')}</span>
                            </>
                          ) : user.subscription_status === 'expired' ? (
                            <>
                              <XCircle className="w-4 h-4 text-red-500" />
                              <span className="text-red-500">{t('expired')}</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-gray-500" />
                              <span className="text-gray-500">{t('noSubscription')}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleExtendSubscription(user.id)}>
                            <Calendar className="w-4 h-4 mr-1" /> {t('extendSubscription')}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={user.email === 'demo@gmail.com'} // Prevent deleting demo user
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
};

export default DeveloperPage;