import {assert} from 'chai';

import {compareBirthDateStrings} from '../src/hcertmatch';

suite('birthdate', () => {
    test('basic', () => {
        // not matching
        assert.isFalse(compareBirthDateStrings("1979", "1980"));
        assert.isFalse(compareBirthDateStrings("1979-01", "1979-02"));
        assert.isFalse(compareBirthDateStrings("1979-01-02", "1979-01-03"));
        assert.isFalse(compareBirthDateStrings("-", "1980"));
        assert.isFalse(compareBirthDateStrings(" ", "1980"));
        assert.isFalse(compareBirthDateStrings("1-2-3-4", "1-2-3-4"));

        // matching, to some extend
        assert.equal(compareBirthDateStrings("", "1980-01-01"), 0);
        assert.equal(compareBirthDateStrings("1979-01", "1979-01"), 2);
        assert.equal(compareBirthDateStrings("1979-01-02", "1979-01-02"), 3);
        assert.equal(compareBirthDateStrings("1979-01", "1979-01"), 2);
        assert.equal(compareBirthDateStrings("1979", "1979"), 1);
        assert.equal(compareBirthDateStrings("1979", ""), 0);
        assert.equal(compareBirthDateStrings("", ""), 0);
    });
});
