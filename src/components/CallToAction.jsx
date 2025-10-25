import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

const CallToAction = () => {
  const { t } = useLanguage();

  return (
    <motion.p
      className='text-md text-white max-w-lg mx-auto'
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.8 }}
    >
      {t('callToAction')}
    </motion.p>
  );
};

export default CallToAction;