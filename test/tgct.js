import {assert, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as tgtc from '../src/tgct.js';

use(chaiAsPromised);

const TEST_PUBKEY = {
    "kty": "EC",
    "crv": "P-256",
    "x": "3XlWImsznd8IRk7E9rglPNL0opdOiREINjisZbsnLLs",
    "y": "fuu73gDiiUi3UYdNcpEXU1zZfBSLooTuzYIpwbI84J8",
    "alg": "ES256"
};

const TEST_CERT = 'TGCT:C$CDI94JCOPCY1AOH9C AHB93-9BH9.%50FFB$DC7BCLF409$8D$1B4ED:DDJ+8M$DNKE NA%PEY$D%8D/L6Q$E11B1VDMKD9EDO7BCLF$09GFFJ.D*8D NA%PE- D*8D 094ED/DD3FFLS8G9FETA9X6ETAJX6HS85FF-JD KFTJDDFF/DD%PE- DC/E/DD$%6PJDBX6JLFSVETS8SVEUTA1ED M8E5647B1VDMKDAEDCPD8ZA%-DZ$5.X67AFW7ASUDWHA8ZAAH8 ZCCC8%8E0Y6T*6-IAXTAH2CUG8%N9YJESB8GX6-A7--A59FVDB84F54EDG63M682B3VECN9GG6RJE567GB8O D-X6%JCA3DADA.-A7X5 1';

suite('tgtc', () => {
    test('tgtc', async () => {
        let result = await tgtc.decodeTestResult(TEST_CERT, TEST_PUBKEY);
        assert.equal(result.firstname, 'Erika');
        assert.equal(result.lastname, 'Musterfrau');
        assert.equal(result.date, '2021-09-09T12:53:22Z');
        assert.equal(result.dob, '1979-04-14');
        assert.equal(result.type, 'RAT');
    });

    test('tgtc invalid pubkey', async () => {
        let brokenKey = Object.assign({}, TEST_PUBKEY);
        brokenKey.x = 'foobar';
        assert.isRejected(tgtc.decodeTestResult(TEST_CERT, brokenKey));
    });

    test('tgtc invalid prefix', async () => {
        assert.isRejected(tgtc.decodeTestResult('HC1:' + TEST_CERT, TEST_PUBKEY));
    });

    test('tgtc invalid cert', async () => {
        assert.isRejected(tgtc.decodeTestResult(TEST_CERT + 'GARBAGE', TEST_PUBKEY));
    });
});