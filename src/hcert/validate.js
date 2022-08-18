import {importHCert, fetchTrustData, trustAnchorProd, trustAnchorTest} from './utils.js';
import {
    validateHCertRules,
    ValueSets,
    BusinessRules,
    decodeValueSets,
    decodeJSONBusinessRules,
    RuleValidationResult,
    getValidUntil,
} from './rules';
import {name as pkgName} from './../../package.json';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {createInstance} from '../i18n.js';
import {withDate} from './utils.js';

export class RegionResult {
    constructor() {
        /** @type {string} */
        this.country = null;
        /** @type {string} */
        this.region = null;
        /** @type {boolean} Wether the HCERT is valid according to the regional rules */
        this.isValid = false;
        /** @type {string} Contains an error message if isValid === false */
        this.error = null;
        /** @type {Date|null} */
        this.validUntil = null;
    }
}

export class ValidationResult {
    constructor() {
        /** @type {boolean} Wether the HCERT itself + signature is valid */
        this.isValid = false;
        /** @type {string} Contains an error message if isValid === false*/
        this.error = null;
        /** @type {string} Contains an error key if isValid === false*/
        this.errorKey = null;
        /** @type {string} */
        this.firstname = null;
        /** @type {string} */
        this.firstname_t = null;
        /** @type {string} */
        this.lastname = null;
        /** @type {string} */
        this.lastname_t = null;
        /** @type {string} */
        this.dob = null;
        /** @type {Object<string, RegionResult>} Contains a result for each region as long as isValid === true*/
        this.regions = {};
    }
}

export class Validator {
    /**
     * @param {Date} trustDate - The date used to verify the trust data, the HCERT signature and to select the rules
     * @param {boolean} production
     */
    constructor(trustDate, production = true) {
        let dir = production ? 'prod' : 'test';
        this._trustAnchor = production ? trustAnchorProd : trustAnchorTest;
        this._baseUrl = commonUtils.getAssetURL(pkgName, 'dgc-trust/' + dir);
        this._verifier = null;
        /** @type {BusinessRules} */
        this._businessRules = null;
        /** @type {ValueSets} */
        this._valueSets = null;
        this._loaded = false;
        this._trustDate = trustDate;
    }

    async _ensureData() {
        // Does all the one time setup if not already done
        // XXX: this is racy if called concurrently
        if (this._loaded === true) return;
        let hcert = await importHCert();
        let trustData = await fetchTrustData(this._baseUrl);
        this._verifier = withDate(this._trustDate, () => {
            return new hcert.VerifierTrustList(
                this._trustAnchor,
                trustData['trustlist'],
                trustData['trustlistsig']
            );
        });
        this._businessRules = await decodeJSONBusinessRules(
            hcert,
            trustData,
            this._trustAnchor,
            this._trustDate
        );
        this._valueSets = await decodeValueSets(
            hcert,
            trustData,
            this._trustAnchor,
            this._trustDate
        );
        this._loaded = true;
    }

    /**
     * Validate the HCERT for a given Date, usually the current date.
     *
     * Returns a ValidationResult or throws if validation wasn't possible.
     *
     * @param {string} cert
     * @param {Date} date
     * @param {string} [lang]
     * @param {string} [country]
     * @param {string[]} [regions]
     * @returns {ValidationResult}
     */
    async validate(cert, date, lang = 'en', country = 'AT', regions = ['ET']) {
        await this._ensureData();

        let i18n = createInstance();
        i18n.changeLanguage(lang);

        /*
        // Iterate through all errors and use the description in the language we prefere the most
        let getTranslatedErrors = (errors) => {
            let languages = i18n.languages + ['en'];
            let translated = [];
            for (let error of errors) {
                let text = 'unknown';
                let prio = -1;
                for (let [ln, desc] of Object.entries(error)) {
                    let thisPrio = languages.indexOf(ln);
                    if (prio === -1) {
                        text = desc;
                        prio = thisPrio;
                    } else if (thisPrio !== -1 && thisPrio < prio) {
                        text = desc;
                        prio = thisPrio;
                    }
                }
                translated.push(text);
            }
            translated.sort();
            return translated;
        };*/

        // Verify that the signature is correct and decode the HCERT.
        // This also verifies if the signature is still valid, so mock the date
        let hcertData = withDate(this._trustDate, () => {
            return this._verifier.verify(cert);
        });

        let result = new ValidationResult();
        if (hcertData.isValid) {
            let greenCertificate = hcertData.greenCertificate;

            result.isValid = true;
            result.firstname = greenCertificate.nam.gn ?? '';
            result.lastname = greenCertificate.nam.fn ?? '';
            result.firstname_t = greenCertificate.nam.gnt ?? '';
            result.lastname_t = greenCertificate.nam.fnt ?? '';
            result.dob = greenCertificate.dob ?? '';

            for (let region of regions) {
                let regionResult = new RegionResult();
                regionResult.country = country;
                regionResult.region = region;

                let businessRules = this._businessRules.filter(country, region);
                /** @type {RuleValidationResult} */
                let res = validateHCertRules(
                    greenCertificate,
                    businessRules,
                    this._valueSets,
                    date,
                    this._trustDate
                );

                if (res.isValid) {
                    regionResult.isValid = true;

                    // according to the rules, returns null if it never becomes invalid
                    let validUntil = getValidUntil(
                        greenCertificate,
                        businessRules,
                        this._valueSets,
                        date
                    );

                    let isFullDate = (date) => {
                        // https://github.com/ehn-dcc-development/hcert-kotlin/pull/64
                        return date && date.includes('T');
                    };

                    // If anything regarding the certificate stops being valid earlier
                    // than the rules then it takes precedence
                    let meta = hcertData.metaInformation;
                    if (isFullDate(meta.certificateValidUntil)) {
                        let certificateValidUntil = new Date(meta.certificateValidUntil);
                        if (validUntil === null || certificateValidUntil < validUntil) {
                            validUntil = certificateValidUntil;
                        }
                    }

                    if (isFullDate(meta.expirationTime)) {
                        let expirationTime = new Date(meta.expirationTime);
                        if (validUntil === null || expirationTime < validUntil) {
                            validUntil = expirationTime;
                        }
                    }

                    regionResult.validUntil = validUntil;
                } else {
                    regionResult.isValid = false;
                    regionResult.error = res.errors;
                    /*regionResult.error = i18n.t('hcert.cert-not-valid-error', {
                        error: getTranslatedErrors(res.errors).join('\n'),
                    });*/
                    regionResult.errorKey = 'hcert.cert-not-valid-error';
                }

                result.regions[region] = regionResult;
            }
        } else {
            result.isValid = false;
            result.error = hcertData.error;
            result.errorKey = 'hcert.cert-validation-failed-error';
            // result.error = i18n.t('hcert.cert-validation-failed-error', {error: hcertData.error});
        }

        return result;
    }
}
