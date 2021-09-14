import {decode as b45decode} from 'base45-web';
import {compactVerify} from 'jose/jws/compact/verify';
import {parseJwk} from 'jose/jwk/parse';

export const DEFAULT_PUBLIC_KEY= {
    kty:  "EC",
    crv: "P-256",
    x:"Qv7m4gjqJoyikM76jjS1YUGkxn_29NP10GBQnxZMOsY",
    y: "3nkVieAj0P5cR97yghINR_uAVNQJMHQAKqCwhCJbcEY",
    alg: "ES256"
};

const PREFIX = 'TGCT:';

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
        publicKey = DEFAULT_PUBLIC_KEY;
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