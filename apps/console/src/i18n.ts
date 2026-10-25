import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { sharedResources, defaultNS } from '@acc/i18n';
import consoleEn from './locales/en/console.json';
import consoleVi from './locales/vi/console.json';

const resources = {
  en: {
    ...sharedResources.en,
    console: consoleEn,
  },
  vi: {
    ...sharedResources.vi,
    console: consoleVi,
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    defaultNS,
    fallbackNS: defaultNS,
    lng: 'en', // default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export default i18n;
