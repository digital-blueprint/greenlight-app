import {assert} from 'chai';
import {encodeAdditionalInformation} from '../src/crypto';

suite('encodeAdditionalInformation', () => {
    test('encodeAdditionalInformation', async () => {
        let res = await encodeAdditionalInformation('token', 'local-proof');
        assert.isString(res);
    });
});
