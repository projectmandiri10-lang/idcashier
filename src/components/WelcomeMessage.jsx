import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

const WelcomeMessage = () => {
  const { t } = useLanguage();

  return (
    <motion.p
      className='text-xl md:text-2xl text-white max-w-2xl mx-auto'
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.5 }}
    >
      {t('welcomeMessagePart1')} <span className='font-semibold text-purple-300'>{t('welcomeMessagePart2')}</span>{t('welcomeMessagePart3')}
    </motion.p>
  );
};

export default WelcomeMessage;