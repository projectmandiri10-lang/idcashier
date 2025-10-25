import React from 'react';
import { useNavigation } from '@/contexts/NavigationContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const NavigationDemo = () => {
  const { currentPage, navigationParams, navigateTo, clearNavigationParams } = useNavigation();
  const { t } = useLanguage();

  return (
    <Card className="m-4">
      <CardHeader>
        <CardTitle>{t('navDemoTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold">{t('currentPageLabel')}</h3>
          <p>{currentPage}</p>
        </div>
        
        <div>
          <h3 className="font-semibold">{t('navParamsLabel')}</h3>
          <pre className="bg-muted p-2 rounded text-sm">
            {JSON.stringify(navigationParams, null, 2)}
          </pre>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigateTo('dashboard')}>{t('goToDashboard')}</Button>
          <Button onClick={() => navigateTo('sales')}>{t('goToSales')}</Button>
          <Button onClick={() => navigateTo('reports', { activeTab: 'profitloss' })}>
            {t('goToReports')}
          </Button>
          <Button onClick={clearNavigationParams} variant="outline">
            {t('clearParams')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default NavigationDemo;