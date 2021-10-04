import * as commonUtils from '@dbp-toolkit/common/utils';
import {name as pkgName} from './../../package.json';
import MockDate from 'mockdate';

/**
 * @param {Date} date 
 * @param {callback} callback 
 */
export function withDate(date, callback) {
    MockDate.set(date.toISOString());
    try {
        return callback();
    } finally {
        MockDate.reset();
    }
}

/**
 * XXX: hcert-kotlin depends on cbor-web, which uses BigInt internally,
 * but BigInt support isn't available in Safari <=13 and there is no
 * way to polyfill it (either via a library or babel). Since we don't
 * use the BigInt functionality of CBOR we fake a minimal replacement
 * for the time we load hcert-kotlin inm case it is missing.
 *
 * @param {callback} callback
 */
async function withFakeBigInt(callback) {
    const fakeBigInt = (v) => {
        return parseInt(v);
    };
    fakeBigInt.prototype = {};
    if (window.BigInt === undefined) {
        window.BigInt = fakeBigInt;
        try {
            // XXX: since we yield here this whole thing is sadly racy
            // and other code might see our BigInt
            return await callback();
        } finally {
            if (window.BigInt === fakeBigInt) {
                delete window.BigInt;
            }
        }
    }
    return await callback();
}

/**
 * Returns the hcert-kotlin module
 * 
 * @returns {object} The module
 */
export async function importHCert() {
    // The bundle can only be loaded as a normal module, so
    // we inject it into the body, extract it from window
    // and then try to cover all traces of what we did.
    // So we can kinda pretend that this is like an ES module..
    let promise = importHCert._promise;
    if (promise === undefined) {
        promise = new Promise((resolve, reject) => {
            let script = document.createElement('script');
            script.onload = function () {
                let hcert = window.hcert;
                delete window.hcert;
                document.head.removeChild(script);
                resolve(hcert);
            };
            script.onerror = function (e) {
                document.head.removeChild(script);
                reject(e);
            };
            script.src = commonUtils.getAssetURL(pkgName, 'hcert-kotlin.js');
            document.head.appendChild(script);
          });
          importHCert._promise = promise;
    }

    return withFakeBigInt(async () => {return await promise;});
}

export const trustAnchorProd = `-----BEGIN CERTIFICATE-----
MIIB1DCCAXmgAwIBAgIKAXnM+Z3eG2QgVzAKBggqhkjOPQQDAjBEMQswCQYDVQQG
EwJBVDEPMA0GA1UECgwGQk1TR1BLMQwwCgYDVQQFEwMwMDExFjAUBgNVBAMMDUFU
IERHQyBDU0NBIDEwHhcNMjEwNjAyMTM0NjIxWhcNMjIwNzAyMTM0NjIxWjBFMQsw
CQYDVQQGEwJBVDEPMA0GA1UECgwGQk1TR1BLMQ8wDQYDVQQFEwYwMDEwMDExFDAS
BgNVBAMMC0FUIERHQyBUTCAxMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEl2tm
d16CBHXwcBN0r1Uy+CmNW/b2V0BNP85y5N3JZeo/8l9ey/jIe5mol9fFcGTk9bCk
8zphVo0SreHa5aWrQKNSMFAwDgYDVR0PAQH/BAQDAgeAMB0GA1UdDgQWBBRTwp6d
cDGcPUB6IwdDja/a3ncM0TAfBgNVHSMEGDAWgBQfIqwcZRYptMGYs2Nvv90Jnbt7
ezAKBggqhkjOPQQDAgNJADBGAiEAlR0x3CRuQV/zwHTd2R9WNqZMabXv5XqwHt72
qtgnjRgCIQCZHIHbCvlgg5uL8ZJQzAxLavqF2w6uUxYVrvYDj2Cqjw==
-----END CERTIFICATE-----`;

export const trustAnchorTest = `-----BEGIN CERTIFICATE-----
MIIB6zCCAZGgAwIBAgIKAXmEuohlRbR2qzAKBggqhkjOPQQDAjBQMQswCQYDVQQG
EwJBVDEPMA0GA1UECgwGQk1TR1BLMQowCAYDVQQLDAFRMQwwCgYDVQQFEwMwMDEx
FjAUBgNVBAMMDUFUIERHQyBDU0NBIDEwHhcNMjEwNTE5MTMwNDQ3WhcNMjIwNjE5
MTMwNDQ3WjBRMQswCQYDVQQGEwJBVDEPMA0GA1UECgwGQk1TR1BLMQowCAYDVQQL
DAFRMQ8wDQYDVQQFEwYwMDEwMDExFDASBgNVBAMMC0FUIERHQyBUTCAxMFkwEwYH
KoZIzj0CAQYIKoZIzj0DAQcDQgAE29KpT1eIKsy5Jx3J0xpPLW+fEBF7ma9943/j
4Z+o1TytLVok9cWjsdasWCS/zcRyAh7HBL+oyMWdFBOWENCQ76NSMFAwDgYDVR0P
AQH/BAQDAgeAMB0GA1UdDgQWBBQYmsL5sXTdMCyW4UtP5BMxq+UAVzAfBgNVHSME
GDAWgBR2sKi2xkUpGC1Cr5ehwL0hniIsJzAKBggqhkjOPQQDAgNIADBFAiBse17k
F5F43q9mRGettRDLprASrxsDO9XxUUp3ObjcWQIhALfUWnserGEPiD7Pa25tg9lj
wkrqDrMdZHZ39qb+Jf/E
-----END CERTIFICATE-----`;


/**
 * Fetches all the data needed for validating the certificate in parallel
 * 
 * @param {string} baseUrl
 * @returns {object}
 */
export async function fetchTrustData(baseUrl)
{
    let keys = ['rules', 'rulessig', 'trustlist', 'trustlistsig', 'valuesets', 'valuesetssig'];
    let data = {};

    for(let key of keys) {
        data[key] = fetch(baseUrl + '/' + key);
    }

    for(let [key, promise] of Object.entries(data)) {
        let response = await promise;
        if (!response.ok) {
            throw Error(response.statusText);
        }
        data[key] = await response.arrayBuffer();
    }

    return data;
}