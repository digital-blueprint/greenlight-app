
const { CompactEncrypt } = require('jose/jwe/compact/encrypt');
const { parseJwk } = require('jose/jwk/parse');
const {encode} = require('jose/util/base64url');

// const jose = require('node-jose');
// const jose = require('jose');

// console.log("jose", jose);

/**
 * This "encrypts" the additional information string using the current oauth2
 * token, using A256GCM and PBES2-HS256+A128KW.
 *
 * Since we can't do any server side validation the user needs to confirm in the
 * UI that he/she won't abuse the system.
 *
 * By using the token we make replaying an older requests harder and by using
 * JOSE which needs crypto APIs, abusing the system can't reasonably be done by
 * accident but only deliberately.
 *
 * This doesn't make things more secure, it just makes the intent of the user
 * more clear in case the API isn't used through our UI flow.
 *
 * @param {string} token 
 * @param {string} additionalInformation 
 * @returns {string}
 */
async function encodeAdditionalInformation(token, additionalInformation) {
    const encoder = new TextEncoder();
    const key = await parseJwk({kty: 'oct', k: encode(token)}, 'PBES2-HS256+A128KW');
    const jwe = await new CompactEncrypt(encoder.encode(additionalInformation))
        .setProtectedHeader({alg: 'PBES2-HS256+A128KW', enc: 'A256GCM'})
        .encrypt(key);
    return jwe;
}

module.exports.encodeAdditionalInformation = encodeAdditionalInformation;
