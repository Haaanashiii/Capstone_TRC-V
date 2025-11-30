import React, { createContext, useState, useEffect, useCallback } from 'react';

export const I18nContext = createContext();

/**
 * I18nProvider - Global internationalization provider
 * Manages language state, translations loading, and language switching
 */
export const I18nProvider = ({ children }) => {
  const [language, setLanguage] = useState('en');
  const [translations, setTranslations] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load language from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem('appLanguage');
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'tl')) {
      setLanguage(savedLanguage);
    }
  }, []);

  // Fetch translations from remote JSON files
  const loadTranslations = useCallback(async (lang) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(`[I18n] Loading translations for language: ${lang}`);
      
      // Load translations from public/translations folder
      const response = await fetch(`/translations/${lang}.json`);
      
      if (!response.ok) {
        throw new Error(`Failed to load translations for ${lang}`);
      }
      
      const data = await response.json();
      console.log(`[I18n] Successfully loaded ${lang} translations:`, Object.keys(data));
      console.log('[I18n] Sample translation - franchiseApplication.title:', data.franchiseApplication?.title);
      setTranslations(data);
      setLoading(false);
    } catch (err) {
      console.error('[I18n] Error loading translations:', err);
      setError(err.message);
      setLoading(false);
      
      // Fallback to empty object to prevent app crash
      setTranslations({});
    }
  }, []);

  // Load translations when language changes
  useEffect(() => {
    console.log('[I18n] Language changed to:', language);
    loadTranslations(language);
  }, [language, loadTranslations]);

  // Toggle between English and Tagalog
  const toggleLanguage = useCallback(() => {
    const newLanguage = language === 'en' ? 'tl' : 'en';
    console.log(`[I18n] Toggling language from ${language} to ${newLanguage}`);
    setLanguage(newLanguage);
    localStorage.setItem('appLanguage', newLanguage);
  }, [language]);

  // Change to specific language
  const changeLanguage = useCallback((lang) => {
    if (lang === 'en' || lang === 'tl') {
      setLanguage(lang);
      localStorage.setItem('appLanguage', lang);
    }
  }, []);

  // Translation function with nested key support
  // Not using useCallback to ensure it always uses fresh translations
  const t = (key, defaultValue = '') => {
    if (!key) return defaultValue;
    
    // Support nested keys like "navbar.home"
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Return key as fallback if translation not found
        console.warn(`[I18n] Translation not found for key: ${key} in language: ${language}`);
        return defaultValue || key;
      }
    }
    
    const result = typeof value === 'string' ? value : defaultValue || key;
    
    // Debug logging for specific keys
    if (key.includes('franchiseApplication')) {
      console.log(`[I18n] t("${key}") in ${language}:`, result);
    }
    
    return result;
  };

  // Create context value - recreated whenever dependencies change
  const value = {
    language,
    translations,
    loading,
    error,
    toggleLanguage,
    changeLanguage,
    t
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};
