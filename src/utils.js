export function parseGreenPassQRCode(data, id) {
    // The QR code is of the format: "?$id:$hash"
    let index = data.indexOf(id);
    if (index === -1) throw new Error('invalid green pass format');

    let passData = data.substring(index + id.length);

    if (passData === '') throw new Error('invalid green pass qr code');

    return data;
}

/**
 * Escapes strings for regular expressions
 * see: https://stackoverflow.com/a/6969486/1581487
 *
 * @param string
 * @returns {string} escaped
 */
export function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

/**
 * Dummy function to mark strings as i18next keys for i18next-scanner
 *
 * @param {string} key
 * @param {object} [options]
 * @returns {string} The key param as is
 */
export function i18nKey(key, options) {
    return key;
}

/**
 * Dummy function to evaluate a i18next key from a variable
 *
 * @param {Function} t
 * @param {string} key
 * @param {object} [options]
 * @returns {string} The key param as is
 */
export function i18nForKey(t, key, options) {
    let dummy = t;
    return dummy(key, options);
}
