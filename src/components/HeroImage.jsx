import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

const HeroImage = () => {
  const { t } = useLanguage();

  return (
    <div className='flex justify-center items-center'>
      <img 
        src='https://imagedelivery.net/LqiWLm-3MGbYHtFuUbcBtA/119580eb-abd9-4191-b93a-f01938786700/public' 
        alt={t('heroImageAlt')} 
      />
    </div>
  );
};

export default HeroImage;