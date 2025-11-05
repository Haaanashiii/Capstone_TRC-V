import React, { useState } from 'react';
import UnifiedSidebar from '../../components/UnifiedSidebar';

export default function RequestAmendment() {
  const [language, setLanguage] = useState('en');

  const translations = {
    en: { title: 'REQUEST FOR AMENDMENT', toggleLanguage: 'Tagalog' },
    tl: { title: 'HILING PARA SA PAG-AAYOS', toggleLanguage: 'English' }
  };

  const t = translations[language];

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
