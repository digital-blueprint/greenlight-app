import {assert} from 'chai';
import {securityByObscurity} from '../src/crypto';

suite('securityByObscurity', () => {
    test('securityByObscurity', async () => {
        let res = await securityByObscurity('token', 'local-proof');
        assert.isString(res);
    });
});
