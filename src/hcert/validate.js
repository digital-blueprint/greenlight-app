import {importHCert, fetchTrustData, trustAnchorProd, trustAnchorTest} from './utils.js';
import {validateHCertRules, ValueSets, BusinessRules, decodeValueSets, decodeBusinessRules, RuleValidationResult, getValidUntil} from "./rules";
import {name as pkgName} from './../../package.json';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {createInstance} from '../i18n.js';

export class ValidationResult {

    constructor() {
        /** @type {boolean} */
        this.isValid = false;
        /** @type {string} */
        this.error = null;
        /** @type {string} */
        this.firstname = null;
        /** @type {string} */
        this.lastname = null;
        /** @type {string} */
        this.dob = null;
        /** @type {Date|null} */
        this.validUntil = null;
    }
}

export class Validator {

    /**
     * @param {boolean} production
     */
    constructor(production=true) {
        let dir = production ? 'prod' : 'test';
        this._trustAnchor = production ? trustAnchorProd : trustAnchorTest;
        this._baseUrl = commonUtils.getAssetURL(pkgName, 'dgc-trust/' + dir);
        this._overridesUrl = commonUtils.getAssetURL(pkgName, `dgc-trust/rulesoverrides.${dir}.json`);
        this._verifier = null;
        /** @type {BusinessRules} */
        this._businessRules = null;
        /** @type {ValueSets} */
        this._valueSets = null;
        this._loaded = false;
    }

    async _applyRulesOverrides() {
        let r = await fetch(this._overridesUrl);
        if (!r.ok) {
            throw new Error(r);
        }
        let overrides = await r.json();
        console.assert(this._businessRules);
        for(let [id, rule] of Object.entries(overrides.overrides)) {
            this._businessRules.override(id, 'AT', 'ET', rule);
        }
    }

    async _ensureData()
    {
        // Does all the one time setup if not already done
        if (this._loaded === true)
            return;
        let hcert = await importHCert();
        let trustData = await fetchTrustData(this._baseUrl);
        this._verifier = new hcert.VerifierTrustList(
            this._trustAnchor, trustData['trustlist'], trustData['trustlistsig']);
        this._businessRules = await decodeBusinessRules(hcert, trustData, this._trustAnchor);
        this._businessRules = this._businessRules.filter('AT', 'ET');
        // XXX: We don't do overrides atm, so don't fetch them
        // await this._applyRulesOverrides();
        this._valueSets = await decodeValueSets(hcert, trustData, this._trustAnchor);
        this._loaded = true;
    }

    /**
     * Validate the HCERT for a given Date, usually the current date.
     * 
     * Returns a ValidationResult or throws if validation wasn't possible.
     * 
     * If computeValidUntil=true then the returned ValidationResult will have
     * the validUntil property set.
     * 
     * @param {string} cert
     * @param {Date} dateTime
     * @param {string} [lang]
     * @param {boolean} [computeValidUntil]
     * @returns {ValidationResult}
     */
     async validate(cert, dateTime, lang='en', computeValidUntil=false) {
        await this._ensureData();

        let i18n = createInstance();
        i18n.changeLanguage(lang);

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
        };

        // Verify that the signature is correct and decode the HCERT
        let hcertData = this._verifier.verify(cert);

        let result = new ValidationResult();

        if (hcertData.isValid) {
            let greenCertificate = hcertData.greenCertificate;
            /** @type {RuleValidationResult} */
            let res = validateHCertRules(greenCertificate, this._businessRules, this._valueSets, dateTime, dateTime);

            if (res.isValid) {
                result.isValid = true;
                result.firstname = greenCertificate.nam.gn ?? '';
                result.lastname = greenCertificate.nam.fn ?? '';
                result.dob = greenCertificate.dob ?? '';
                if (computeValidUntil) {
                    result.validUntil = getValidUntil(
                        greenCertificate, this._businessRules, this._valueSets, dateTime);
                }
            } else {
                result.isValid = false;
                result.error = i18n.t('hcert.cert-not-valid-error', {error: getTranslatedErrors(res.errors).join('\n')});
            }
        } else {
            result.isValid = false;
            result.error = i18n.t('hcert.cert-validation-failed-error', {error: hcertData.error});
        }
    
        return result;
    }
}
