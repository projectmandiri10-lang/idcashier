import React, { createContext, useContext, useState, useEffect } from 'react';

const NavigationContext = createContext();

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
};

export const NavigationProvider = ({ children }) => {
  const [currentPage, setCurrentPage] = useState(() => {
    // Initialize from localStorage or default to 'dashboard'
    return localStorage.getItem('currentPage') || 'dashboard';
  });
  
  const [navigationParams, setNavigationParams] = useState(() => {
    // Initialize from localStorage or default to empty object
    const savedParams = localStorage.getItem('navigationParams');
    return savedParams ? JSON.parse(savedParams) : {};
  });

  // Update localStorage when currentPage changes
  useEffect(() => {
    localStorage.setItem('currentPage', currentPage);
  }, [currentPage]);

  // Update localStorage when navigationParams changes
  useEffect(() => {
    localStorage.setItem('navigationParams', JSON.stringify(navigationParams));
  }, [navigationParams]);

  const navigateTo = (page, params = {}) => {
    setCurrentPage(page);
    setNavigationParams(params);
  };

  const clearNavigationParams = () => {
    setNavigationParams({});
  };

  const value = {
    currentPage,
    setCurrentPage,
    navigationParams,
    setNavigationParams,
    navigateTo,
    clearNavigationParams
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};