//import foo from '../assets/hcert-kotlin.js';

// see https://gitlab.tugraz.at/dbp/greenlight/greenlight-docs/-/blob/main/rules.md
const profiles = [
    { name: "Einreise", antigen: 48, pcr: 72, vac1: 90, vac2: 270, allowedVaccines: ["EU/1/20/1528", "EU/1/20/1507", "EU/1/20/1507", "EU/1/21/1529", "EU/1/20/1525", "BBIBP-CorV", "CoronaVac"] },
    { name: "Eintrittstest", antigen: 48, pcr: 72, vac1: 90, vac2: 270, allowedVaccines: ["EU/1/20/1528", "EU/1/20/1507", "EU/1/20/1507", "EU/1/21/1529", "EU/1/20/1525"] },
    { name: "Nachtgastronomie", antigen: 0, pcr: 72, vac1: 90, vac2: 270, allowedVaccines: ["EU/1/20/1528", "EU/1/20/1507", "EU/1/20/1507", "EU/1/21/1529", "EU/1/20/1525", "BBIBP-CorV", "CoronaVac"] },
    { name: "Berufsgruppentest", antigen: 168, pcr: 168, vac1: 90, vac2: 270, allowedVaccines: ["EU/1/20/1528", "EU/1/20/1507", "EU/1/20/1507", "EU/1/21/1529", "EU/1/20/1525"] },
];

export const hcertValidation = async (hc1) => {
    const profile = profiles[1]; //Eintrittstest

    let firstname;
    let lastname;
    let dob;
    let expires = 0;
    let status = 422;
    let valid = false;
    let type = 'invalid';
    let description = 'HCert is not valid';

    const hcertData = await validateTrustList(hc1);

    if (hcertData === null) {
        status = 500;
        description = 'cannot process input';
    } else if (hcertData.isValid) {
        valid = true;
        status = 201;
        description = 'HCert is valid';

        if (hcertData.greenCertificate.v) {
            const v = hcertData.greenCertificate.v[0];
            type = 'vaccination';

            if (profile.allowedVaccines.includes(v.mp)) {
                if (v.sd === v.dn) {
                    // 1 of 1 or 2 of 2
                    expires = Date.parse(v.dt).valueOf() + profile.vac2 * 24 * 60 * 60 * 1000;
                } else if (v.sd > v.dn) {
                    expires = Date.parse(v.dt).valueOf() + profile.vac1 * 24 * 60 * 60 * 1000;
                }
            } else {
                status = 400;
                description = 'vaccine not approved';
            }
        } else if (hcertData.greenCertificate.t) {
            const t = hcertData.greenCertificate.t[0];
            type = 'test';

            switch (t.tt) {
                case 'LP217198-3':
                    expires = Date.parse(t.sc).valueOf() + profile.antigen * 60 * 60 * 1000;
                    break;
                case 'LP6464-4':
                    expires = Date.parse(t.sc).valueOf() + profile.pcr * 60 * 60 * 1000;
                    break;
                default:
                    status = 400;
                    description = 'test not approved';
            }
        } else if (hcertData.greenCertificate.r) {
            const r = hcertData.greenCertificate.r[0];
            type = 'recovery';

            expires = Date.parse(r.fr).valueOf() + 180 * 24 * 60 * 60 * 1000;
        }

        firstname = hcertData.greenCertificate.nam.gn;
        lastname = hcertData.greenCertificate.nam.fn;
        dob = hcertData.greenCertificate.dob;
    }

    return {
        firstname: firstname,
        lastname: lastname,
        dob: dob,
        expires: expires,
        valid: valid,
        type: type,
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
