import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { sharedResources, defaultNS } from '@acc/i18n';

i18n
  .use(initReactI18next)
  .init({
    resources: sharedResources,
    defaultNS,
    fallbackNS: defaultNS,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
