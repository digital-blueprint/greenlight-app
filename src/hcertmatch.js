import stringSimilarity from "string-similarity";

/**
 * Splits a date string.
 *
 * @param string | null string
 * @returns {object|null} birthdate
 */
function splitDateString(string)
{
    let parts = string.split('-');
    if (string === "") {
        parts = [];
    }
    if (parts.length > 3) {
        return null;
    }
    let birthdate = {};
    birthdate.year = parts[0] !== undefined ? parts[0] : null;
    birthdate.month = parts[1] !== undefined ? parts[1] : null;
    birthdate.day = parts[2] !== undefined ? parts[2] : null;
    return birthdate;
}

/**
 * Compares two birth date strings.
 *
 * @param {string} string1 - an empty string, only a day, day and month or the full birth date
 * @param {string} string2 - an empty string, only a day, day and month or the full birth date
 * @returns {(number | boolean)} matcher - returns the maximal matching number or false if it didn't match
 */
export function compareBirthDateStrings(string1, string2)
{
    let parts1 = splitDateString(string1);
    let parts2 = splitDateString(string2);
    if (parts1 === null || parts2 === null) {
        return false;
    }

    let matches = 0;
    if (parts1.year !== null && parts2.year !== null) {
        if (parts1.year !== parts2.year) {
            return false;
        }
        matches++;
        if (parts1.month !== null && parts2.month !== null) {
            if (parts1.month !== parts2.month) {
                return false;
            }
            matches++;
            if (parts1.day !== null && parts2.day !== null) {
                if (parts1.day !== parts2.day) {
                    return false;
                }
                matches++;
            }
        }
    }

    return matches;
}

function removeDiacriticsKinda(input) {
    // We decompose each composed character and take the first one of the result.
    // This has the nice side effect of getting rid of diacritics.
    let out = "";
    for (const c of Array.from(input.normalize('NFC'))) {
        out += Array.from(c.normalize('NFD'))[0];
    }
    return out;
}

/**
 * Removes diacritics, maps to lowercase
 *
 * @param {string} input 
 * @returns {string}
 */
function normalizeName(input) {
    return removeDiacriticsKinda(input).normalize('NFC').toUpperCase().toLowerCase();
}

/**
 * Compares the input and returns a score from 0 to 1 (0 meaning no match)
 * 
 * @param {string} s1 
 * @param {string} s2 
 * @returns {number}
 */
function compareNames(s1, s2)
{
    return stringSimilarity.compareTwoStrings(normalizeName(s1), normalizeName(s2));
}

/**
 * Checks if the name and birth date of a certificate match the data we have about them.
 * 
 * This is a very loose check since both come from different sources and we only want to prevent
 * very obvious problems, like scanning the wrong certificate by accident.
 * 
 * The dates and firstName can be empty strings to mean the information is missing.
 *
 * @param {string} firstName
 * @param {string} lastName
 * @param {string} dateOfBirth
 * @param {string} personFirstName
 * @param {string} personLastName
 * @param {string} personDateOfBirth
 * @returns {boolean} - returns if the person mathes with the other person
 */
export function checkPerson(firstName, lastName, dateOfBirth, personFirstName, personLastName, personDateOfBirth) {
    let dateMatches = compareBirthDateStrings(dateOfBirth, personDateOfBirth);
    if (dateMatches === false) {
        return false;
    }

    // if birdthdate could be checked in day, month and year then we can lower the impact of the name matching
    const limit = 0.8 - (dateMatches * 0.10);

    // check firstname if there is one set in the certificate
    if (firstName !== "") {
        let personFirstNameShorted = personFirstName.split(/\s+/);
        let firstNameShorted = firstName.split(/\s+/);
        let firstNameSimilarity = compareNames(personFirstNameShorted[0], firstNameShorted[0]);

        if (personFirstNameShorted[1] !== undefined && firstNameSimilarity <= limit) {
            firstNameSimilarity = compareNames(personFirstNameShorted[1], firstNameShorted[0]);
        }
        if (firstNameShorted[1] !== undefined && firstNameSimilarity <= limit) {
            firstNameSimilarity = compareNames(personFirstNameShorted[0], firstNameShorted[1]);
        }
        if (firstNameShorted[1] !== undefined && personFirstNameShorted[1] !== undefined && firstNameSimilarity <= limit) {
            firstNameSimilarity = compareNames(personFirstNameShorted[1], firstNameShorted[1]);
        }
        // return false if firstname isn't similar enough
        if (firstNameSimilarity < limit) {
            return false;
        }
    }
    let lastNameSimilarity = compareNames(lastName, personLastName);

    // return false if lastname isn't similar enough
    return lastNameSimilarity >= limit;
}