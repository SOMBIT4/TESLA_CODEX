"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  type Locale,
  type MessageKey,
  translate,
} from "@/lib/i18n/messages";

const LOCALE_STORAGE_KEY = "locale";

interface LocaleContextValue {
  locale: Locale;
  isHydrated: boolean;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
}

const defaultContext: LocaleContextValue = {
  locale: "en",
  isHydrated: false,
  setLocale: () => undefined,
  t: (key) => translate("en", key),
};

const LocaleContext = createContext<LocaleContextValue>(defaultContext);

interface LocaleProviderProps {
  children: ReactNode;
}

export function LocaleProvider({ children }: LocaleProviderProps) {
  const [locale, setLocale] = useState<Locale>("en");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);

    if (storedLocale === "en" || storedLocale === "bn") {
      setLocale(storedLocale);
    }

    setIsHydrated(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;

    if (isHydrated) {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
  }, [isHydrated, locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      isHydrated,
      setLocale,
      t: (key) => translate(locale, key),
    }),
    [isHydrated, locale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useI18n(): LocaleContextValue {
  return useContext(LocaleContext);
}
