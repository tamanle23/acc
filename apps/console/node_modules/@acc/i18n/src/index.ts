import commonEn from './locales/en/common.json';
import commonVi from './locales/vi/common.json';

export const defaultNS = 'common';

export const sharedResources = {
  en: {
    common: commonEn,
  },
  vi: {
    common: commonVi,
  },
} as const;

export { commonEn, commonVi };
