import {decode as b45decode} from 'base45-web';
import {compactVerify} from 'jose/jws/compact/verify';
import {parseJwk} from 'jose/jwk/parse';
import * as commonUtils from "@dbp-toolkit/common/utils";
import {name as pkgName} from "../package.json";

/**
 * See https://gitlab.tugraz.at/dbp/greenlight/tugraz-covid-test-cert for the
 * format documentation
 */

 export const TEST_PUBLIC_KEY= {
    kty: "EC",
    crv: "P-256",
    x: "3XlWImsznd8IRk7E9rglPNL0opdOiREINjisZbsnLLs",
    y: "fuu73gDiiUi3UYdNcpEXU1zZfBSLooTuzYIpwbI84J8",
    alg: "ES256"
};

// FIXME: this is currently the test key from
// https://gitlab.tugraz.at/dbp/greenlight/tugraz-covid-test-cert/-/tree/main/test-cert
// Needs to be replaced with the real public key
export const PROD_PUBLIC_KEY= {
    kty: "EC",
    crv: "P-256",
    x: "3XlWImsznd8IRk7E9rglPNL0opdOiREINjisZbsnLLs",
    y: "fuu73gDiiUi3UYdNcpEXU1zZfBSLooTuzYIpwbI84J8",
    alg: "ES256"
};

export const PREFIX = 'TGCT:';

export class TestResult {

    constructor() {
        /** @type {string} */
        this.firstname = null;
        /** @type {string} */
        this.lastname = null;
        /** @type {string} */
        this.date = null;
        /** @type {string} */
        this.dob = null;
        /** @type {string} */
        this.type = null;
    }

}

/**
 * Decodes a TGCT certificate and returns a TestResult.
 * If decoding fails because the input is wrong or the signatrure
 * couldn't be verified then it throws.
 * 
 * @param {string} payload 
 * @param {object} [publicKey]
 * @returns {TestResult}
 * @throws on error
 */
export async function decodeTestResult(payload, publicKey) {
    if (publicKey === undefined) {
        publicKey = PROD_PUBLIC_KEY;
    }
    if (!payload.startsWith(PREFIX)) {
        throw new Error('Not supported');
    }
    payload = payload.slice(PREFIX.length);
    let jwt = new Uint8Array(b45decode(payload));
    let jwk = await parseJwk(publicKey);
    let jwsDecoded = await compactVerify(jwt, jwk, {algorithms: ['ES256']});
    let data = JSON.parse(new TextDecoder().decode(jwsDecoded.payload));

    let result = new TestResult();
    result.firstname = data.firstname;
    result.lastname = data.lastname;
    result.date = data.date;
    result.dob = data.dob;
    result.type = data.type;

    return result;
}


/**
 * FIXME: remove this function,
 * this is just a shim to provide a similar interface to the server one.
 *
 * Use Validator/ValidationResult directly.
 * No personal data are returned in case of error!
 *
 * @param {string} tgtc
 * @param {string} lang
 */
export async function tgctValidation(tgtc, lang)
{
    let result = {
        status: -1,
        error: null,
        data : {
            firstname: null,
            lastname: null,
            dob: null,
            validUntil: null,
        }
    };

    let res;
    try {
        res = await decodeTestResult(tgtc, PROD_PUBLIC_KEY);
        const url = commonUtils.getAssetURL(pkgName, 'internal/university-internal-test-rules.json');
        const rules = await fetch(url).then(x => x.json());
        const now = Date.now();
        let validUntil = checkAgainstRules(res, rules, now, lang);
        res.isValid = validUntil ? true : false;
        res.validUntil = typeof validUntil === "number" ? new Date(validUntil) : "";
    } catch (error) {
        result.status = 500;
        result.error = error.message;
        console.log("TgCert validation error", error);
        return result;
    }

    if (res.isValid) {
        result.status = 201;
        result.data.firstname = res.firstname;
        result.data.lastname = res.lastname;
        result.data.dob = res.dob;
        result.data.validUntil =  res.validUntil;
    } else {
        console.log("Tgcert invalid");
        result.status = 422;
        result.error = res.error;
    }

    return result;
}

/**
 * Check the decoded test against the internal test business rules
 *
 * @param {object} decodedTest
 * @param {object} rules
 * @param {number} date
 * @param {string} lang 'de' or 'en'
 */
export function checkAgainstRules(decodedTest, rules, date, lang="en")
{
    date = Date.parse('2021-09-10T10:00:00'); // TODO: remove after testing

    const test_date = Date.parse(decodedTest.date);
    for (let i = 0; i < rules.rules.length; i++) {
        const r = rules.rules[i];
        const from = Date.parse(r.from);
        const until = Date.parse(r.until);
        //console.log(date, (test_date + r['hours-valid']*3600000), date <= (test_date + r['hours-valid']*3600000));
        if (date >= from && date <= until && r.type === decodedTest.type) {
            if (date <= (test_date + r['hours-valid']*3600000)) {
                return test_date + r['hours-valid']*3600000;
            }
            decodedTest.error = r['invalid-messages'][lang];
            return false;
        }
    }
    decodedTest.error = lang === 'de' ? 'Keine anwendbare Regel gefunden.' : 'no applicable rule found.';
    return false;
}