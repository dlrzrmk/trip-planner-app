import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import translations, { DEFAULT_LANG, LANGUAGES } from './translations';

const STORAGE_KEY = 'tp_lang';
const VALID_CODES = LANGUAGES.map((l) => l.code);

function detectInitialLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_CODES.includes(stored)) return stored;
  } catch {}
  const nav = (navigator.language || '').slice(0, 2).toLowerCase();
  if (VALID_CODES.includes(nav)) return nav;
  return DEFAULT_LANG;
}

function resolve(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

const LanguageContext = createContext(null);
export function useLang() {
  return useContext(LanguageContext);
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectInitialLang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = (code) => {
    if (!VALID_CODES.includes(code)) return;
    setLangState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {}
  };
  const t = useMemo(
    () =>
      (path, ...args) => {
        const value = resolve(translations[lang], path) ?? resolve(translations[DEFAULT_LANG], path);
        if (typeof value === 'function') return value(...args);
        if (value == null) return path;
        return value;
      },
    [lang]
  );
  const value = useMemo(() => ({ lang, setLang, t, languages: LANGUAGES }), [lang, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
