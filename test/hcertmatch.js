import {assert} from 'chai';

import {compareBirthdayStrings} from '../src/hcertmatch';

suite('birthdate', () => {
    test('basic', () => {
        assert.isFalse(compareBirthdayStrings("1979", "1980"));
        assert.isFalse(compareBirthdayStrings("1979-01", "1979-02"));
        assert.isFalse(compareBirthdayStrings("1979-01-02", "1979-01-03"));

        // FIXME:
        //assert.equal(compareBirthdayStrings("", "1980-01-01"), 0);
        //assert.equal(compareBirthdayStrings("1979-01", "1979-01"), 2);
        //assert.equal(compareBirthdayStrings("1979", "1979"), 1);
        //assert.equal(compareBirthdayStrings("1979", ""), 0);
        //assert.equal(compareBirthdayStrings("", ""), 0);
    });
});
