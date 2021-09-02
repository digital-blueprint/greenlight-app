import {assert} from 'chai';

import {compareBirthDateStrings, checkPerson} from '../src/hcertmatch';

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

suite('matchPerson', () => {
    test('basic', () => {
        // Clearly matching
        assert.isTrue(checkPerson("Erika", "Musterfrau", "", "Erika", "Musterfrau", ""));
        assert.isTrue(checkPerson("Erika", "Musterfrau", "2000", "Erika", "Musterfrau", ""));
        assert.isTrue(checkPerson("Erika", "Musterfrau", "2000", "Erika", "Musterfrau", "2000-01"));
        assert.isTrue(checkPerson("Erika", "Musterfrau", "2000-01", "Erika", "Musterfrau", "2000-01"));
        assert.isTrue(checkPerson("Erika", "Musterfrau", "2000-01-02", "Erika", "Musterfrau", "2000-01"));
        assert.isTrue(checkPerson("Erika", "Musterfrau", "2000-01-02", "Erika", "Musterfrau", "2000-01-02"));
        assert.isTrue(checkPerson("Isolde Erika", "Musterfrau-Gößinger Müller", "", "Isolde Erika", "Musterfrau-Gößinger Müller", ""));

        // Clearly not matching
        assert.isNotTrue(checkPerson("Erika", "Musterfrau", "", "Max", "Mustermann", ""));
        assert.isNotTrue(checkPerson("Erika", "Musterfrau", "2000-01-02", "Erika", "Musterfrau", "2000-01-03"));
        assert.isNotTrue(checkPerson("Erika", "Musterfrau", "2000", "Erika", "Musterfrau", "2001"));
        assert.isNotTrue(checkPerson("Erika", "Musterfrau", "2000-01", "Erika", "Musterfrau", "2000-02"));

        // Matching, but debatable
        assert.isTrue(checkPerson("Erika Anna", "Musterfrau", "2000", "Erika", "Musterfrau", "2000-01-02"));
        assert.isTrue(checkPerson("Christoph", "Musterfrau", "", "Christof", "Musterfrau", ""));
        assert.isTrue(checkPerson("ERIKA", "MUSTERFRAU", "", "Erika", "Musterfrau", ""));
        assert.isTrue(checkPerson("Robert", "Bárány", "", "ROBERT", "BARANY", ""));
        assert.isTrue(checkPerson("Erwin", "Schrödinger", "", "Erwin", "Schroedinger", ""));
        assert.isTrue(checkPerson("David", "Háček", "", "David", "Hacek", ""));
        assert.isTrue(checkPerson("Çelik", "Yıldırım", "", "Celik", "Yildirim", ""));
        assert.isTrue(checkPerson("İsmail", "Avcı", "", "Ismail", "Avci", ""));
        assert.isTrue(checkPerson("Christian", "Musterfrau", "2000-01-01", "Christof", "Musterfrau", "2000-01-01"));
        assert.isTrue(checkPerson("Christine", "Musterfrau", "", "Christina", "Musterfrau", ""));
        assert.isTrue(checkPerson("Foo Bar", "Quux Buzz", "", "Foo", "Quux Buzz", ""));
        assert.isTrue(checkPerson("Foo Bar", "Quux Buzz", "", "Bar", "Quux Buzz", ""));
        assert.isTrue(checkPerson("", "", "", "", "", ""));
        assert.isTrue(checkPerson(" ", " ", "", " ", " ", ""));
        assert.isTrue(checkPerson("", "Musterfrau", "", "Christof", "Musterfrau", ""));
        assert.isTrue(checkPerson("Franz", "Mueller", "2000", "Franz", "Müller", "2000"));
        assert.isTrue(checkPerson("Franz", "Strasser", "", "Franz", "Straßer", ""));

        // Not matching, but detbatable
        assert.isNotTrue(checkPerson("Christian", "Musterfrau", "", "Christof", "Musterfrau", ""));
        assert.isNotTrue(checkPerson("Franz", "Meier Müller", "", "Franz", "Müller", ""));
    });
});