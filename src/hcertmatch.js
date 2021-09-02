import stringSimilarity from "string-similarity";

/**
 * Splits a birthday string.
 *
 * @param string | null string
 * @returns {Array} birthdate
 */
function splitBirthdayString(string)
{
    let parts = string.split('-');
    let birthdate = {};
    birthdate.year = parts[0] ? parts[0] : null;
    birthdate.month = parts[1] ? parts[1] : null;
    birthdate.day = parts[2] ? parts[2] : null;

    return birthdate;
}

/**
 * Compares two birthday strings.
 *
 * @param {?string} string1 - an empty string, only a day, day and month or the full birthdate
 * @param {?string} string2 - an empty string, only a day, day and month or the full birthdate
 * @returns {(number | boolean)} matcher - returns the maximal matching number
 */
export function compareBirthdayStrings(string1, string2)
{
    if (string1 === null || string1 === '' || string2 === null || string2 === '') {
        // if a birthday is not set, return true
        return true;
    }
    let parts1 = splitBirthdayString(string1);
    let parts2 = splitBirthdayString(string2);
    let matcher = 0;

    if (parts1.day && parts2.day && parts1.day !== parts2.day) {
        // if days are set but don't match, return false
        return false;
    } else {
        matcher = matcher + 1;
        if (parts1.month && parts2.month && parts1.month !== parts2.month) {
            // if months are set but don't match, return false
            return false;
        } else {
            matcher = matcher + 1;
            if (parts1.year !== parts2.year) {
                // if years don't match, return false
                return false;
            }
        }
    }
    matcher = matcher + 1;


    return matcher;
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
    let match = compareBirthdayStrings(personDob, dob);
    if (!match) {
        return false;
    }

    // if birdthdate could be checked in day, month and year then we can lower the impact of the name matching
    const percent = match === 3 ? 80 : 50;

    let firstNameSimilarityPercent = 0;
    // check firstname if there is one set in the certificate
    if (firstName !== "") {

        let personFirstNameShorted = personFirstName.split(" ");
        let firstNameShorted = firstName.split(" ");
        firstNameSimilarityPercent = stringSimilarity.compareTwoStrings(personFirstNameShorted[0], firstNameShorted[0]) * 100;

        if (personFirstNameShorted[1] !== null && firstNameSimilarityPercent <= match) {
            firstNameSimilarityPercent = stringSimilarity.compareTwoStrings(personFirstNameShorted[1], firstNameShorted[0]) * 100;
        }
        if (firstNameShorted[1] !== null && firstNameSimilarityPercent <= match) {
            firstNameSimilarityPercent = stringSimilarity.compareTwoStrings(personFirstNameShorted[0], firstNameShorted[1]) * 100;
        }
        if (firstNameShorted[1] !== null && personFirstNameShorted[1] !== null && firstNameSimilarityPercent <= match) {
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