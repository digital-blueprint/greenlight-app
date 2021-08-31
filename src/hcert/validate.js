import {importHCert, fetchTrustData, trustAnchorProd} from './utils.js';
import {filterRules, validateHCertRules, valueSetsToLogic, decodeValueSets, decodeBusinessRules, RuleValidationResult} from "./rules";
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
        this.trustAnchor = trustAnchorProd;
        this.baseUrl = commonUtils.getAssetURL(pkgName, 'dgc-trust/prod');
        this.trustData = null;
        this.verifier = null;
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
        let hcertData = this.verifier.verify(cert);

        let result = new ValidationResult();

        if (hcertData.isValid) {
            let greenCertificate = hcertData.greenCertificate;
            let res = await this._validateRules(greenCertificate, dateTime);

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

    async _ensureData()
    {
        // Does all the one time setup if not already done
        if (this.trustData !== null && this.verifier !== null)
            return;
        this.trustData = await fetchTrustData(this.baseUrl);
        let hcert = await importHCert();
        this.verifier = new hcert.VerifierTrustList(
            this.trustAnchor, this.trustData['trustlist'], this.trustData['trustlistsig']);
    }

    /**
     * Validate a cert against the business rules
     * 
     * @param {object} cert 
     * @param {Date} dateTime 
     * @returns {RuleValidationResult}
     */
    async _validateRules(cert, dateTime) {
        await this._ensureData();

        let hcert = await importHCert();
        // Validate against the business rules for "entry test in Austria"
        let businessRules = filterRules(await decodeBusinessRules(hcert, this.trustData, this.trustAnchor, dateTime), 'AT', 'ET');
        let valueSets = valueSetsToLogic(await decodeValueSets(hcert, this.trustData, this.trustAnchor, dateTime));
        return validateHCertRules(cert, businessRules, valueSets, dateTime);
    }
}
