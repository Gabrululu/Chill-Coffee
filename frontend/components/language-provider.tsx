'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { spanish } from '@/lib/translations';

type Language = 'en' | 'es';
type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (text: string) => string;
};
const LanguageContext = createContext<LanguageContextValue>({ language: 'en', setLanguage: () => {}, t: text => text });
const storageKey = 'chill-cafe-language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === 'es' || saved === 'en') setLanguageState(saved);
    } catch { /* The selector also works when browser storage is unavailable. */ }
  }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  function setLanguage(next: Language) {
    setLanguageState(next);
    try { localStorage.setItem(storageKey, next); } catch { /* Keep the session preference. */ }
  }
  return <LanguageContext.Provider value={{ language, setLanguage, t: text => language === 'es' ? spanish[text] ?? text : text }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() { return useContext(LanguageContext); }

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  return <div className="language-switcher" role="group" aria-label={language === 'es' ? 'Idioma' : 'Language'}>
    <button type="button" lang="en" aria-label="English" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
    <button type="button" lang="es" aria-label="Español" aria-pressed={language === 'es'} onClick={() => setLanguage('es')}>ES</button>
  </div>;
}
