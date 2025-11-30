import { useContext } from 'react';
import { I18nContext } from '../contexts/I18nContext';

/**
 * useTranslation Hook
 * Provides access to translation function, language state, and language controls
 * 
 * Usage:
 * const { t, language, toggleLanguage } = useTranslation();
 * <h1>{t('welcome')}</h1>
 * <button onClick={toggleLanguage}>{t('toggleLanguage')}</button>
 */
export const useTranslation = () => {
  const context = useContext(I18nContext);
  
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  
  // Debug logging
  console.log('[useTranslation] Current language:', context.language);
  console.log('[useTranslation] Translations loaded:', Object.keys(context.translations || {}).length > 0);
  console.log('[useTranslation] Loading state:', context.loading);
  
  return context;
};
