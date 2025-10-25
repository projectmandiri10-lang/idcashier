import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSelector from '@/components/LanguageSelector';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/components/ui/use-toast';
import { authAPI } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';
import { Mail, Lock, AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Use the custom logo.png file
  const logoUrl = "/logo.png";
  
  // Check if we have a reset token in the URL hash (Supabase Auth sends tokens in hash/fragment)
  useEffect(() => {
    // Parse URL hash yang dikirim Supabase Auth
    const hash = window.location.hash;
    console.log('Current URL hash:', hash);
    console.log('Full URL:', window.location.href);
    
    const hashParams = new URLSearchParams(hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const type = hashParams.get('type');
    const errorParam = hashParams.get('error');
    const errorDescription = hashParams.get('error_description');
    
    // Handle errors from Supabase
    if (errorParam) {
      console.error('Supabase Auth error:', errorParam, errorDescription);
      toast({
        title: t('error'),
        description: errorDescription || 'Failed to process password reset link',
        variant: 'destructive',
        duration: 8000
      });
      return;
    }
    
    // Jika ada recovery session dari email
    if (accessToken && type === 'recovery') {
      console.log('Recovery session detected, setting session...');
      console.log('Access token length:', accessToken.length);
      console.log('Refresh token present:', !!refreshToken);
      
      // Set session di Supabase client
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      }).then(({ data, error }) => {
        if (!error && data.session) {
          console.log('Recovery session set successfully');
          console.log('Session user:', data.session.user.email);
          setIsResetMode(true);
          toast({
            title: t('success'),
            description: 'You can now reset your password',
            duration: 3000
          });
        } else {
          console.error('Failed to set recovery session:', error);
          toast({
            title: t('error'),
            description: 'Invalid or expired reset link. Please request a new one.',
            variant: 'destructive',
            duration: 8000
          });
        }
      });
    } else if (hash && !accessToken) {
      console.warn('Hash present but no access token found:', hash);
      console.warn('Possible redirect URL misconfiguration in Supabase Dashboard');
    }
  }, [toast, t]);

  // Countdown timer for rate limiting
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Basic email validation
    if (!email || !email.includes('@')) {
      toast({
        title: t('error'),
        description: t('pleaseEnterValidEmail'),
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }
    
    try {
      const result = await authAPI.requestPasswordReset(email);
      
      if (result.success) {
        setRequestSent(true);
        setCountdown(120); // 2 minutes countdown (rate limit: 2 emails per hour)
        toast({
          title: t('success'),
          description: t('resetPasswordEmailSent'),
          duration: 8000,
        });
      } else {
        toast({
          title: t('error'),
          description: result.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: t('error'),
        description: error.message || t('passwordResetRequestFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Validate passwords
    if (password.length < 6) {
      toast({
        title: t('error'),
        description: t('passwordMinLength'),
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }
    
    if (password !== confirmPassword) {
      toast({
        title: t('error'),
        description: t('passwordsDoNotMatch'),
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }
    
    try {
      // Langsung update password (session sudah di-set di useEffect)
      const result = await authAPI.updatePassword(password);
      
      if (result.error) throw result.error;

      toast({
        title: t('success'),
        description: t('passwordResetSuccess'),
      });
      
      // Sign out setelah reset untuk clear session
      await supabase.auth.signOut();
      
      // Redirect to login page after a short delay
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      console.error('Reset password error:', error);
      
      // Check if error is due to invalid/expired token
      const isTokenError = error.message?.includes('token') || 
                           error.message?.includes('expired') || 
                           error.message?.includes('invalid') ||
                           error.message?.includes('session');
      
      toast({
        title: t('error'),
        description: isTokenError ? t('resetPasswordTokenInvalid') : (error.message || t('passwordResetFailed')),
        variant: 'destructive',
        duration: isTokenError ? 8000 : 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{isResetMode ? t('resetPassword') : t('forgotPassword')} - idCashier</title>
        <meta name="description" content={t('resetPasswordMetaDesc')} />
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
                <p className="text-white/80">
                  {isResetMode ? t('resetYourPassword') : t('forgotYourPassword')}
                </p>
              </div>

              {!isResetMode ? (
                // Request Reset Form
                <form onSubmit={handleRequestReset} className="space-y-6">
                  {/* Information Alert */}
                  <Alert className="bg-blue-500/10 border-blue-500/20">
                    <Info className="h-4 w-4 text-blue-400" />
                    <AlertDescription className="text-white/90 text-sm">
                      {t('resetPasswordInstructions')}
                      <br />
                      <span className="text-white/70 text-xs">{t('resetPasswordLinkExpiry')}</span>
                    </AlertDescription>
                  </Alert>

                  {requestSent && (
                    <Alert className="bg-green-500/10 border-green-500/20">
                      <Info className="h-4 w-4 text-green-400" />
                      <AlertDescription className="text-white/90 text-sm">
                        {t('resetPasswordCheckEmail')}
                      </AlertDescription>
                    </Alert>
                  )}

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
                        disabled={isLoading || countdown > 0}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-white text-purple-600 hover:bg-white/90 font-semibold"
                    disabled={isLoading || countdown > 0}
                  >
                    {isLoading ? t('sending') : countdown > 0 ? `${t('sending')} (${countdown}s)` : t('sendResetLink')}
                  </Button>

                  {requestSent && (
                    <div className="text-center">
                      <button
                        type="button"
                        className="text-white/60 hover:text-white/80 text-sm underline"
                        onClick={() => setRequestSent(false)}
                      >
                        {t('resetPasswordNotReceived')}
                      </button>
                      <p className="text-white/50 text-xs mt-2">{t('resetPasswordTroubleshooting')}</p>
                    </div>
                  )}

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => navigate('/login')}
                      className="text-white/80 hover:text-white underline"
                    >
                      {t('backToLogin')}
                    </button>
                  </div>
                </form>
              ) : (
                // Reset Password Form
                <form onSubmit={handleResetPassword} className="space-y-6">
                  {/* Confirmation Alert */}
                  <Alert className="bg-green-500/10 border-green-500/20">
                    <Info className="h-4 w-4 text-green-400" />
                    <AlertDescription className="text-white/90 text-sm">
                      {t('resetPasswordInProgress')}
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-white">{t('newPassword')}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                        placeholder="••••••••"
                        required
                        disabled={isLoading}
                        minLength={6}
                      />
                    </div>
                    {/* Password strength indicator */}
                    {password && (
                      <div className="flex gap-1 mt-2">
                        <div className={`h-1 flex-1 rounded ${password.length >= 6 ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div className={`h-1 flex-1 rounded ${password.length >= 8 ? 'bg-green-500' : 'bg-gray-500'}`} />
                        <div className={`h-1 flex-1 rounded ${password.length >= 10 && /[A-Z]/.test(password) && /[0-9]/.test(password) ? 'bg-green-500' : 'bg-gray-500'}`} />
                      </div>
                    )}
                    <p className="text-white/50 text-xs">{t('passwordMinLength')}</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-white">{t('confirmPassword')}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                        placeholder="••••••••"
                        required
                        disabled={isLoading}
                      />
                    </div>
                    {/* Password match indicator */}
                    {confirmPassword && (
                      <p className={`text-xs ${password === confirmPassword ? 'text-green-400' : 'text-red-400'}`}>
                        {password === confirmPassword ? '✓ ' + t('passwordsMatch') : '✗ ' + t('passwordsDoNotMatch')}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-white text-purple-600 hover:bg-white/90 font-semibold"
                    disabled={isLoading}
                  >
                    {isLoading ? t('resetting') : t('resetPassword')}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => navigate('/login')}
                      className="text-white/80 hover:text-white underline"
                    >
                      {t('backToLogin')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </div>

        <footer className="p-6 text-center text-white/80 space-y-2">
          <p className="text-sm">
            <span className="font-semibold">{t('address')}:</span> Jl. Buaran PLN Tangerang
          </p>
          <p className="text-sm">
            <span className="font-semibold">{t('contact')}:</span> Telp/WA: +6285156861485
          </p>
        </footer>
      </div>
    </>
  );
};

export default ResetPasswordPage;