import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { subscriptionAPI } from '@/lib/api';
import { Calendar, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const SubscriptionPage = () => {
  const { t } = useLanguage();
  const { user, token } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionEndDate, setSubscriptionEndDate] = useState(null);
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [loading, setLoading] = useState(true);

  const isDemoAccount = user?.email === 'demo@gmail.com';

  useEffect(() => {
    const checkSubscription = async () => {
      if (!user || !token) return;
      
      // For demo account, always show as active
      if (isDemoAccount) {
        setIsSubscribed(true);
        setSubscriptionEndDate('2099-12-31');
        setSubscriptionData({
          start_date: new Date().toISOString().split('T')[0],
          end_date: '2099-12-31',
          is_active: true
        });
        setLoading(false);
        return;
      }
      
      try {
        // Fetch subscription data from the backend
        const subscription = await subscriptionAPI.getCurrentUserSubscription(token);
        setSubscriptionData(subscription);
        
        if (subscription) {
          const today = new Date();
          const endDate = new Date(subscription.end_date);
          const isActive = endDate >= today;
          
          setIsSubscribed(isActive);
          setSubscriptionEndDate(subscription.end_date);
        } else {
          // If no subscription data, assume valid subscription to avoid blocking users
          setIsSubscribed(true);
          setSubscriptionEndDate('2099-12-31');
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
        // If there's any error, assume valid subscription to avoid blocking users
        setIsSubscribed(true);
        setSubscriptionEndDate('2099-12-31');
      } finally {
        setLoading(false);
      }
    };

    checkSubscription();
  }, [user, token, isDemoAccount]);

  // Format dates for display
  const formatDate = (dateString) => {
    if (!dateString) return t('noData');
    try {
      const date = new Date(dateString);
      return format(date, 'dd MMMM yyyy', { locale: id });
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p>{t('loadingData')}</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{t('subscription')} - idCashier</title>
        <meta name="description" content={t('subscriptionMetaDesc')} />
      </Helmet>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t('subscription')}</h1>
          <p className="text-muted-foreground">{t('subscriptionSubtitle')}</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isSubscribed ? (
                  <>
                    <CheckCircle />
                    {t('subscriptionStatus')}: {t('active')}
                  </>
                ) : (
                  <>
                    <XCircle />
                    {t('subscriptionStatus')}: {t('expired')}
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-primary/80 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-6 h-6" />
                    <span className="font-semibold">{t('registeredDate')}</span>
                  </div>
                  <p className="text-2xl font-bold">{user?.created_at ? formatDate(user.created_at) : t('noData')}</p>
                </div>
                <div className="bg-primary/80 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-6 h-6" />
                    <span className="font-semibold">{t('expiryDate')}</span>
                  </div>
                  <p className="text-2xl font-bold">{subscriptionEndDate ? formatDate(subscriptionEndDate) : t('noData')}</p>
                </div>
                <div className="bg-primary/80 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-6 h-6" />
                    <span className="font-semibold">{t('status')}</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {isSubscribed ? (
                      <span className="text-green-300">{t('active')}</span>
                    ) : (
                      <span className="text-red-300">{t('expired')}</span>
                    )}
                  </p>
                </div>
                <div className="bg-primary/80 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-6 h-6" />
                    <span className="font-semibold">{t('startDate')}</span>
                  </div>
                  <p className="text-2xl font-bold">{subscriptionData?.start_date ? formatDate(subscriptionData.start_date) : t('noData')}</p>
                </div>
              </div>
              
              {isDemoAccount && (
                <div className="mt-6 p-4 bg-primary/60 rounded-lg">
                  <p className="text-center text-sm">
                    {t('demoModeDesc')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  );
};

export default SubscriptionPage;