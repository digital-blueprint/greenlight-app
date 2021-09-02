import certlogic from 'certlogic-js';

export class ValueSets
{
    constructor() {
        /** @type {Date} */
        this.validFrom = null;
        /** @type {Date} */
        this.validUntil = null;
        this.valueSets = [];
    }

    /**
     * Converts an array of value sets to something certlogic can work with
     * 
     * @returns {Array}
     */
    forLogic()
    {
        let logicInput = {};
        for(const set of this.valueSets) {
            logicInput[set.valueSetId] = Object.keys(set.valueSetValues);
        }
        return logicInput;
    }
}

/**
 * Decodes the Austrian version of the value sets
 *
 * @param {object} hcert 
 * @param {object} trustData 
 * @param {string} trustAnchor 
 * @returns {ValueSets}
 */
export async function decodeValueSets(hcert, trustData, trustAnchor)
{
    // This will throw if the current time doesn't fall into validFrom/validUntil
    // Sadly we can't prevent that for testing
    let decoded = hcert.SignedDataDownloader.loadValueSets(trustAnchor, trustData['valuesets'], trustData['valuesetssig']);
    let result = [];
    for (const entry of decoded.second.valueSets) {
        result.push(JSON.parse(entry.valueSet));
    }

    let vs = new ValueSets();
    vs.validFrom = new Date(decoded.first.validFrom);
    vs.validUntil = new Date(decoded.first.validUntil);
    vs.valueSets = result;
    return vs;
}

export class BusinessRules {

    constructor()
    {
        /** @type {Date} */
        this.validFrom = null;
        /** @type {Date} */
        this.validUntil = null;
        this.rules = [];
    }

    /**
     * Filters based on country and region
     * 
     * @param {string} country 
     * @param {string} region 
     * @returns {BusinessRules}
     */
    filter(country, region)
    {
        let filtered = [];
        for(let rule of this.rules) {
            if (rule.Country == country && rule.Region == region) {
                filtered.push(rule);
            }
        }

        let br = new BusinessRules();
        br.rules = filtered;
        br.validFrom = this.validFrom;
        br.validUntil = this.validUntil;
        return br;
    }
}

/**
 * Decode the Austrian version of the business rules
 * 
 * @param {object} hcert 
 * @param {object} trustData 
 * @param {string} trustAnchor 
 * @returns {BusinessRules}
 */
export async function decodeBusinessRules(hcert, trustData, trustAnchor)
{
    // This will throw if the current time doesn't fall into validFrom/validUntil
    // Sadly we can't prevent that for testing
    let decoded = hcert.SignedDataDownloader.loadBusinessRules(trustAnchor, trustData['rules'], trustData['rulessig']);
    let result = [];
    for (const entry of decoded.second.rules) {
        result.push(JSON.parse(entry.rule));
    }
    let br = new BusinessRules();
    br.rules = result;
    br.validFrom = new Date(decoded.first.validFrom);
    br.validUntil = new Date(decoded.first.validUntil);
    return br;
}

/**
 * Returns a rule description useable for an error message
 * 
 * @param {object} rule 
 * @returns {string}
 */
function getRuleErrorDescription(rule) {
    let msg = '['+rule.Identifier+']';
    for (let entry of rule.Description) {
        if (entry.lang === 'en') {
            msg += ' ' + entry.desc;
            break;
        }
    }
    return msg;
}

export class RuleValidationResult {

    constructor() {
        this.isValid = false;
        this.error = null;
    }
}

/**
 * Validates a HCERT against specific business rules, value sets and the current time
 * 
 * Will throw an error in case the HCERT breaks one or more rules.
 * 
 * @param {object} cert
 * @param {BusinessRules} businessRules 
 * @param {ValueSets} valueSets 
 * @param {Date} dateTime
 * @returns {RuleValidationResult}
 */
export function validateHCertRules(cert, businessRules, valueSets, dateTime)
{
    let logicInput = {
        payload: cert,
        external: {
            valueSets: valueSets.forLogic(),
            validationClock: dateTime.toISOString(),
        }
    };

    let errors = [];
    for(let rule of businessRules.rules) {
        // FIXME: should we ignore rules not valid at that time, or should we fail?
        // I can't find anything in the spec, except that this means when the rules are "valid"
        // but not what to do when they aren't
        if (dateTime < new Date(rule.validFrom) || dateTime > new Date(rule.validTo)) {
            console.warn(`rule ${rule.Identifier} not valid anymore`);
        }
        let result = certlogic.evaluate(rule.Logic, logicInput);
        if (result !== true) {
            errors.push(getRuleErrorDescription(rule));
        }
    }

    let result = new RuleValidationResult();

    if (errors.length) {
        result.error = "One or more rules failed:\n" + errors.join("\n");
    } else {
        result.isValid = true;
    }

    return result;
}

/**
 * Returns a Date until the HCERT is valid. fromDate needs to be a Date at which
 * the HCERT is valid. If it isn't valid then null is returned instead.
 *
 * Since the rules can change this of course is just a guess, but still helpful
 * to users.
 *
 * This assumes that a valid HCERT that as time goes on becomes invalid will
 * never become valid again. If that's not the case then the returned result is
 * undefined.
 *
 * @param {object} hcert 
 * @param {BusinessRules} businessRules 
 * @param {ValueSets} valueSets 
 * @param {Date} fromDate 
 * @returns {null|Date}
 */
export function getValidUntil(hcert, businessRules, valueSets, fromDate)
{
    let isValid = (checkTime) => {
        console.log(checkTime);
        return validateHCertRules(hcert, businessRules, valueSets, checkTime).isValid;
    };

    let fromTimestamp = (timestamp) => {
        return new Date(timestamp);
    };

    // If not valid at fromDate then there is no end date
    if (!isValid(fromDate)) {
        return null;
    }

    // Find a date in the future where the cert is no longer valid
    // Give up once the timestamp overflows
    let start = fromDate.getTime();
    let offset = 3600 * 1000 * 24;
    let checkTime = fromDate;
    // eslint-disable-next-line no-constant-condition
    while (1) {
        let timestamp = start + offset;
        if (timestamp >= Number.MAX_VALUE) {
            return checkTime;
        }
        checkTime = fromTimestamp(timestamp);
        if (!isValid(checkTime)) {
            break;
        }
        offset *= 2;
    }

    // Find the latest date at which the cert is still valid
    let low = fromDate.getTime();
    let high = checkTime.getTime();
    while (low < high) {
        let mid = Math.round(low + (high - low) / 2);
        checkTime = fromTimestamp(mid);
        if (!isValid(checkTime)) {
            if (high === mid) {
                break;
            }
            high = mid;
        } else {
            if (low === mid) {
                break;
            }
            low = mid;
        }
    }

    return fromTimestamp(low);
}
