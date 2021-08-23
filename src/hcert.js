//import foo from '../assets/hcert-kotlin.js';

export const hcertValidation = async (hc1) => {
    const hcertData = await validateTrustList(hc1);

    if (hcertData.isValid) {
        // TODO: transform hcertData.greenCertificate.{v,t,r}
        // v.sd == 2 && v.dn == 2 -> expires = v.dt + 270d
        // v.sd == 1 && v.dn == 1 -> expires = v.dt + 270d, start = v.dt + 22d
        let expires;
        const v = hcertData.greenCertificate.v;
        if (v) {
            expires = v.sd === v.dn ? Date.parse(v.dt).valueOf() + 270*24*60*60*1000 : 0;
        } else {
            const t = hcertData.greenCertificate.t;
            if (t) {
                expires = Date.parse(t.sc).valueOf() + 72*60*60*1000;
            } else {
                const r = hcertData.greenCertificate.r;
                if (r) {
                    expires = Date.parse(r.fr).valueOf() + 180*24*60*60*1000;
                } else {
                    expires = 0;
                }
            }
        }
        const identifier = hcertData.greenCertificate.nam.gn + ',' + hcertData.greenCertificate.nam.fn;

        const init = {status: 201, statusText: "OK"};
        const obj = {expires: expires, identifier: identifier};
        const blob = new Blob([JSON.stringify(obj, null, 2)], {type: 'application/json'});

        return new Response(blob, init);
    }

    const init = {status: 400, statusText: "Bad Data"};
    const obj = {'hydra:title': 'ERROR', 'hydra:description':'HCert not valid'};
    const blob = new Blob([JSON.stringify(obj, null, 2)], {type: 'application/json'});

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

async function validateTrustList(hc1) {
    let result;

    let resultContent = await fetch(contentUrl);
    console.log('resultContent:');
    console.dir(resultContent);
    const abRC = await resultContent.arrayBuffer();
    console.dir(abRC);
    let resultSignature = await fetch(signatureUrl);
    console.log('resultSignature:');
    console.dir(resultSignature);
    const abRS = await resultSignature.arrayBuffer();
    console.dir(abRS);

    try {
        const verifier = new hcert.VerifierTrustList(pemCert, abRC, abRS);
        result = verifier.verify(hc1);
        console.info('validateTrustList(' + hc1.substring(0,32) + '...)');
        console.dir(result);
    } catch (error) {
        console.dir(error);
        return JSON.stringify(error, null, 2);
    }
    return result;
}
