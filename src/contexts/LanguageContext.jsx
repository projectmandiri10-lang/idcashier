import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '@/lib/translations';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('idcashier_language');
    if (saved) return saved;
    
    const browserLang = navigator.language.split('-')[0];
    const supportedLanguages = ['id', 'en', 'zh'];
    return supportedLanguages.includes(browserLang) ? browserLang : 'id';
  });

  useEffect(() => {
    localStorage.setItem('idcashier_language', language);
  }, [language]);

  const t = (key) => {
    return translations[language]?.[key] || translations['id'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};