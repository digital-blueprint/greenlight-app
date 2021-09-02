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

/**
 * Checks if a person is another person
 *
 * @param {string} firstName
 * @param {string} lastName
 * @param {string} dob
 * @param {string} personFirstName
 * @param {string} personLastName
 * @param {string} personDob
 * @returns {boolean} - returns if the person mathes with the other person
 */
export function checkPerson(firstName, lastName, dob, personFirstName, personLastName, personDob) {
    let matches = compareBirthDateStrings(personDob, dob);
    if (matches === false) {
        return false;
    }

    // if birdthdate could be checked in day, month and year then we can lower the impact of the name matching
    const percent = 80 - (matches * 10);

    let firstNameSimilarityPercent = 0;
    // check firstname if there is one set in the certificate
    if (firstName !== "") {

        let personFirstNameShorted = personFirstName.split(" ");
        let firstNameShorted = firstName.split(" ");
        firstNameSimilarityPercent = stringSimilarity.compareTwoStrings(personFirstNameShorted[0], firstNameShorted[0]) * 100;

        if (personFirstNameShorted[1] !== null && firstNameSimilarityPercent <= percent) {
            firstNameSimilarityPercent = stringSimilarity.compareTwoStrings(personFirstNameShorted[1], firstNameShorted[0]) * 100;
        }
        if (firstNameShorted[1] !== null && firstNameSimilarityPercent <= percent) {
            firstNameSimilarityPercent = stringSimilarity.compareTwoStrings(personFirstNameShorted[0], firstNameShorted[1]) * 100;
        }
        if (firstNameShorted[1] !== null && personFirstNameShorted[1] !== null && firstNameSimilarityPercent <= percent) {
            firstNameSimilarityPercent = stringSimilarity.compareTwoStrings(personFirstNameShorted[1], firstNameShorted[1]) * 100;
        }
        // return false if firstname isn't similar enough
        if (firstNameSimilarityPercent < percent) {
            return false;
        }
    }
    let lastNameSimilarityPercent = stringSimilarity.compareTwoStrings(lastName, personLastName) * 100;

    // return false if lastname isn't similar enough
    return lastNameSimilarityPercent >= percent;
}