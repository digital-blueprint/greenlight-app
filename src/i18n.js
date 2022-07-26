import {createInstance as _createInstance} from '@dbp-toolkit/common/i18next.js';

import de from './i18n/de/translation.json';
import en from './i18n/en/translation.json';

export function createInstance() {
    return _createInstance({en: en, de: de}, 'de', 'en');
}

export function addTranslations(i18n) {
    i18n.removeResourceBundle('en', 'translation');
    i18n.removeResourceBundle('de', 'translation');

    i18n.addResourceBundle('en', 'translation', en);
    i18n.addResourceBundle('de', 'translation', de);
}
