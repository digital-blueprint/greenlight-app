import {importHCert, fetchTrustData, trustAnchorProd} from './utils.js';
import {validateHCertRules, ValueSets, BusinessRules, decodeValueSets, decodeBusinessRules, RuleValidationResult} from "./rules";
import {name as pkgName} from './../../package.json';
import * as commonUtils from '@dbp-toolkit/common/utils';

export class ValidationResult {

    constructor() {
        this.isValid = false;
        this.error = null;
        this.firstname = null;
        this.lastname = null;
        this.dob = null;
    }
}

export class Validator {

    constructor() {
        this._trustAnchor = trustAnchorProd;
        this._baseUrl = commonUtils.getAssetURL(pkgName, 'dgc-trust/prod');
        this._verifier = null;
        /** @type {BusinessRules} */
        this._businessRules = null;
        /** @type {ValueSets} */
        this._valueSets = null;
        this._loaded = false;
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
        this._valueSets = await decodeValueSets(hcert, trustData, this._trustAnchor);
        this._loaded = true;
    }

    /**
     * Validate the HCERT for a given Date, usually the current date.
     * 
     * Returns a ValidationResult or throws if validation wasn't possible.
     * 
     * @param {string} cert
     * @param {Date} dateTime
     * @returns {ValidationResult}
     */
     async validate(cert, dateTime) {
        await this._ensureData();

        // Verify that the signature is correct and decode the HCERT
        let hcertData = this._verifier.verify(cert);

        let result = new ValidationResult();

        if (hcertData.isValid) {
            let greenCertificate = hcertData.greenCertificate;
            /** @type {RuleValidationResult} */
            let res = await validateHCertRules(greenCertificate, this._businessRules, this._valueSets, dateTime);

            if (res.isValid) {
                result.isValid = true;
                result.firstname = greenCertificate.nam.gn;
                result.lastname = greenCertificate.nam.fn;
                result.dob = greenCertificate.dob;
            } else {
                result.isValid = false;
                result.error = res.error;
            }
        } else {
            result.isValid = false;
            result.error = hcertData.error;
        }
    
        return result;
    }
}
