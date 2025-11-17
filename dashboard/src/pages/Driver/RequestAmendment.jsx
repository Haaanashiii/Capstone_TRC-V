import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UnifiedSidebar from '../../components/UnifiedSidebar';

export default function RequestAmendment() {
  const [language, setLanguage] = useState('en');
  const navigate = useNavigate();

  const translations = {
    en: { title: 'REQUEST FOR AMENDMENT', toggleLanguage: 'Tagalog' },
    tl: { title: 'HILING PARA SA PAG-AAYOS', toggleLanguage: 'English' }
  };

  const t = translations[language];

  // GATE-KEEPING: Check if user has operator information
  useEffect(() => {
    try {
      const token = sessionStorage.getItem('accessToken');
      if (token) {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        if (!decoded.hasOperator) {
          console.warn('[RequestAmendment] User does not have operator info yet, redirecting to Franchise page');
          navigate('/operator/franchise');
          return;
        }
      } else {
        console.warn('[RequestAmendment] No token found, redirecting to login');
        navigate('/login');
      }
    } catch (error) {
      console.error('[RequestAmendment] Error checking operator status:', error);
      navigate('/login');
    }
  }, [navigate]);

  return (
    <div>
      <UnifiedSidebar userType="operator" language={language} onLanguageToggle={() => setLanguage(language === 'en' ? 'tl' : 'en')} translations={t} />
      <div style={{ padding: 32 }}>
        <h1 style={{ color: '#e6dcdcff' }}>{t.title}</h1>
        <p>laws pa UI.</p>
      </div>
    </div>
  );
}
