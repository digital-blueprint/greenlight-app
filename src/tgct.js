import {decode as b45decode} from 'base45-web';
import {compactVerify} from 'jose/jws/compact/verify';
import {parseJwk} from 'jose/jwk/parse';

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
 */
export async function tgctValidation(tgtc)
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
        res = await decodeTestResult(tgtc, PROD_PUBLIC_KEY); //TODO add validation
        res.isValid = true; //TODO fix me

    } catch (error) {
        result.status = 500;
        result.error = error.message;
        console.log("HCert validation error", error);
        return result;
    }

    if (res.isValid) {
        result.status = 201;
        result.data.firstname = res.firstname;
        result.data.lastname = res.lastname;
        result.data.dob = res.dob;
        result.data.validUntil =  new Date('2022-09-09T12:53:22Z');  //TODO fix me
    } else {
        console.log("Tgtcert invalid");
        result.status = 422;
        result.error = res.error;
    }

    return result;
}
