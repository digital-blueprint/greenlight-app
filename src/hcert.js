//import foo from '../assets/hcert-kotlin.js';

export const hcertValidation = (hc1) => {

    const result = validateTrustList(hc1);

    console.dir(result);

    const init = { status: 201, statusText: "OK" };
    const obj = { expires: 0, identifier: 1 };
    const blob = new Blob([JSON.stringify(obj, null, 2)], {type : 'application/json'});

    return new Response(blob, init);
};

const pemCert = `-----BEGIN CERTIFICATE-----
MIIBJTCBy6ADAgECAgUAwvEVkzAKBggqhkjOPQQDAjAQMQ4wDAYDVQQDDAVFQy1N
ZTAeFw0yMTA0MjMxMTI3NDhaFw0yMTA1MjMxMTI3NDhaMBAxDjAMBgNVBAMMBUVD
LU1lMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE/OV5UfYrtE140ztF9jOgnux1
oyNO8Bss4377E/kDhp9EzFZdsgaztfT+wvA29b7rSb2EsHJrr8aQdn3/1ynte6MS
MBAwDgYDVR0PAQH/BAQDAgWgMAoGCCqGSM49BAMCA0kAMEYCIQC51XwstjIBH10S
N701EnxWGK3gIgPaUgBN+ljZAs76zQIhAODq4TJ2qAPpFc1FIUOvvlycGJ6QVxNX
EkhRcgdlVfUb
-----END CERTIFICATE-----`;
const contentUrl = 'https://dgc.a-sit.at/ehn/cert/listv2';
const signatureUrl = 'https://dgc.a-sit.at/ehn/cert/sigv2';

function validateTrustList(hc1) {
    let result;
    downloadBinary(contentUrl, function (resultContent) {
        downloadBinary(signatureUrl, function (resultSignature) {
            try {
                const verifier = new hcert.VerifierTrustList(pemCert, resultContent, resultSignature);
                result = verifier.verify(hc1);
                console.info(result);
            } catch (error) {
                return JSON.stringify(error, null, 2);
            }
        });
    });
    return result;
}

function downloadBinary(requestUrl, callback) {
    console.log("Downloading " + requestUrl + " ...");
    let xhr = new XMLHttpRequest();
    xhr.open("GET", requestUrl);
    xhr.responseType = "arraybuffer";
    xhr.onload = function () {
        if (this.status === 200) {
            callback(xhr.response);
        } else {
            console.warn(this);
        }
    };
    xhr.send();
}
