import {importHCert} from './utils.js';
import {fetchBusinessRules, fetchValueSets, filterRules, validateHCertRules, valueSetsToLogic} from "./rules";

export const hcertValidation = async (hc1) => {
    let firstname;
    let lastname;
    let dob;
    let status;
    let description = '';

    const hcertData = await validateTrustList(hc1);

    if (hcertData === null) {
        status = 500;
        description = 'cannot process input';
    } else if (hcertData.isValid) {
        let businessRules = filterRules(await fetchBusinessRules(), 'AT', 'ET');
        let valueSets = valueSetsToLogic(await fetchValueSets());
        let currentDateTime = new Date();

        try {
            validateHCertRules(hcertData.greenCertificate, businessRules, valueSets, currentDateTime);
            status = 201;
            description = 'HCert is valid';
        } catch (e) {
            status = 422;
            description = e.message;
        }

        firstname = hcertData.greenCertificate.nam.gn;
        lastname = hcertData.greenCertificate.nam.fn;
        dob = hcertData.greenCertificate.dob;
    } else {
        // hcertData.isValid === false
        status = 403;
        description = hcertData.error;
    }

    return {
        firstname: firstname,
        lastname: lastname,
        dob: dob,
        valid: status === 201,
        status: status,
        description: description,
    };
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
    let hcert = await importHCert();
    let result;

    const resultContent = await fetch(contentUrl);
    const abRC = await resultContent.arrayBuffer();
    const resultSignature = await fetch(signatureUrl);
    const abRS = await resultSignature.arrayBuffer();

    try {
        // eslint-disable-next-line no-undef
        const verifier = new hcert.VerifierTrustList(pemCert, abRC, abRS);
        result = verifier.verify(hc1);
    } catch (error) {
        console.error(error);
        return null;
    }
    return result;
}
