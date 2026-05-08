// src/hooks/useLanguage.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';
import translations, { Lang, tr, TranslationKey } from '../i18n/translations';

type LanguageContextType = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('is');

  const t = (key: string) => {
    // Check if key exists in our translations object
    if (key in translations) {
      return tr(key as TranslationKey, lang);
    }
    return key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
