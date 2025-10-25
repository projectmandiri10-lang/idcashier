import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSelector from '@/components/LanguageSelector';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Lock } from 'lucide-react';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useLanguage();
  const { toast } = useToast();
  const { login } = useAuth();
  const navigate = useNavigate();
  
  // Use the custom logo.png file
  const logoUrl = "/logo.png";

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Normalize email on client side
      const normalizedEmail = email.trim().toLowerCase();
      
      const result = await login(normalizedEmail, password);
      
      if (result.success) {
        toast({
          title: `${t('welcome')} ${result.user.name || result.user.email}!`,
          description: t('loginSuccess'),
        });
        // Redirect to dashboard after successful login
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 200);
      } else {
        // Add hint for user if login fails
        const errorMessage = result.error;
        const errorDescription = errorMessage.includes('password') 
          ? `${errorMessage} ${t('loginHint')}`
          : errorMessage;
          
        toast({
          title: t('loginFailed'),
          description: errorDescription,
          variant: 'destructive',
        });
      }
    } catch (error) {
      // If it's an invalid credentials error, we might want to show a more specific message
      if (error.message.includes('Invalid login credentials')) {
        toast({
          title: t('loginFailed'),
          description: `${t('invalidCredentials')} ${t('loginHint')}`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('loginFailed'),
          description: error.message || t('loginFailedDesc'),
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemo = async () => {
    // For demo purposes, use the predefined demo user credentials
    setIsLoading(true);
    try {
      // Normalize demo email on client side
      const demoEmail = 'demo@gmail.com';
      const normalizedDemoEmail = demoEmail.trim().toLowerCase();
      
      const result = await login(normalizedDemoEmail, 'Demo2025');
      
      if (result.success) {
        toast({
          title: `${t('welcome')} ${result.user.name || result.user.email}!`,
          description: t('loginSuccess'),
        });
        // Redirect to dashboard after successful demo login
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 200);
      } else {
        toast({
          title: t('loginFailed'),
          description: result.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: t('loginFailed'),
        description: error.message || t('loginFailedDesc'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{t('login')} - idCashier</title>
        <meta name="description" content={t('loginMetaDesc')} />
      </Helmet>
      
      <div className="min-h-screen gradient-bg flex flex-col">
        <header className="p-4 flex justify-between items-center">
          <LanguageSelector />
          <ThemeToggle />
        </header>

        <div className="flex-1 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <div className="glass-effect rounded-2xl p-8 shadow-2xl">
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                  className="inline-block mb-4"
                >
                  <img src={logoUrl} alt="idCashier Logo" className="w-24 h-24" onError={(e) => {
                    // Fallback to a simple div with text if image fails to load
                    e.target.onerror = null;
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }} />
                  <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-white font-bold text-2xl mx-auto" 
                       style={{ display: 'none' }}>
                    IC
                  </div>
                </motion.div>
                <h1 className="text-4xl font-bold text-white mb-2">idCashier</h1>
                <p className="text-white/80">{t('tagline')}</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">{t('email')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      placeholder={t('emailPlaceholder')}
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white">{t('password')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      placeholder={t('passwordPlaceholder')}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="text-right">
                    <Link 
                      to="/reset-password" 
                      className="text-sm text-white/80 hover:text-white transition-colors"
                    >
                      {t('forgotPassword')}?
                    </Link>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-white text-purple-600 hover:bg-white/90 font-semibold"
                  disabled={isLoading}
                >
                  {isLoading ? t('loggingIn') : t('login')}
                </Button>

                <Button
                  type="button"
                  onClick={handleDemo}
                  variant="outline"
                  className="w-full border-white/30 text-white hover:bg-white/10 bg-transparent"
                  disabled={isLoading}
                >
                  {t('demoMode')}
                </Button>
              </form>
            </div>
          </motion.div>
        </div>

        <footer className="p-6 text-center text-white/80 space-y-2">
          <p className="text-sm">
            <span className="font-semibold">{t('address')}:</span> {t('footerAddress')}
          </p>
          <p className="text-sm">
            <span className="font-semibold">{t('contact')}:</span> {t('footerContact')}
          </p>
        </footer>
      </div>
    </>
  );
};

export default LoginPage;