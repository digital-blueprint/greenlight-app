import certlogic from 'certlogic-js';
import { withDate } from './utils';

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
 * @param {Date} date 
 * @returns {ValueSets}
 */
export async function decodeValueSets(hcert, trustData, trustAnchor, date)
{
    let decoded = withDate(date, () => {
        return hcert.SignedDataDownloader.loadValueSets(trustAnchor, trustData['valuesets'], trustData['valuesetssig']);
    });
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
        this.rules = [];
    }

    /**
     * Remove all rules matching the partial rule object.
     * If the passed object is empty, none are removed.
     *
     * @param {object} ruleFilter 
     */
    removeAll(ruleFilter)
    {
        let entries = Object.entries(ruleFilter);
        if (entries.length === 0)
            return;
        this.rules = this.rules.filter((rule) => {
            for(let [key, value] in entries) {
                if (rule[key] !== value)
                    return true;
            }
            return false;
        });
    }

    /**
     * Add a new rule
     *
     * @param {object} rule 
     */
    add(rule)
    {
        this.rules.push(rule);
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
        return br;
    }
}

/**
 * Decode the Austrian version of the business rules
 * 
 * @param {object} hcert 
 * @param {object} trustData 
 * @param {string} trustAnchor 
 * @param {Date} date 
 * @returns {BusinessRules}
 */
export async function decodeBusinessRules(hcert, trustData, trustAnchor, date)
{
    let decoded = withDate(date, () => {
        return hcert.SignedDataDownloader.loadBusinessRules(trustAnchor, trustData['rules'], trustData['rulessig']);
    });
    let result = [];
    for (const entry of decoded.second.rules) {
        result.push(JSON.parse(entry.rule));
    }
    let br = new BusinessRules();
    br.rules = result;
    return br;
}

/**
 * Decode the Austrian version of the business rules from JSON instead of CBOR
 * 
 * @param {object} hcert 
 * @param {object} trustData 
 * @param {string} trustAnchor 
 * @param {Date} date 
 * @returns {BusinessRules}
 */
 export async function decodeJSONBusinessRules(hcert, trustData, trustAnchor, date)
 {
    let dataView = new DataView(trustData['rules.json']);
    let decoder = new TextDecoder('utf8');
    let decoded = JSON.parse(decoder.decode(dataView));
    let result = [];
    for (const entry of decoded.r) {
        result.push(JSON.parse(entry.r));
    }
    let br = new BusinessRules();
    br.rules = result;
    return br;
}


/**
 * Returns a rule description useable for an error message
 * 
 * @param {object} rule 
 * @returns {object}
 */
function getRuleErrorDescriptions(rule) {
    let descriptions = {};
    for (let entry of rule.Description) {
        descriptions[entry.lang] = `[${rule.Identifier}] ${entry.desc}`;
    }
    return descriptions;
}

export class RuleValidationResult {

    constructor() {
        this.isValid = false;
        this.errors = [];
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
 * @param {Date} date The time used as input for the rules
 * @param {Date} rulesDate The time used to select the active set of rules
 * @returns {RuleValidationResult}
 */
export function validateHCertRules(cert, businessRules, valueSets, date, rulesDate)
{
    let logicInput = {
        payload: cert,
        external: {
            valueSets: valueSets.forLogic(),
            validationClock: date.toISOString(),
        }
    };

    let valResult = new RuleValidationResult();
    valResult.isValid = true;
    let errors = [];
    for(let rule of businessRules.rules) {
        // In case a rule isn't valid we should just ignore it. This is usually used to update
        // rules at a specific time, in which case there will be rule X which will stop being
        // valid at time T and rule Y which will start being valid at time T.
        if (rulesDate < new Date(rule.ValidFrom) || rulesDate > new Date(rule.ValidTo)) {
            continue;
        }
        let result = certlogic.evaluate(rule.Logic, logicInput);
        if (result !== true) {
            errors.push(getRuleErrorDescriptions(rule));
        }
    }

    if (errors.length) {
        valResult.errors = errors;
        valResult.isValid = false;
    }

    return valResult;
}

/**
 * Returns a Date until the HCERT is valid. fromDate needs to be a Date at which
 * the HCERT is valid. If it isn't valid then null is returned instead. In case
 * it never gets invalid null is also returned;
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
        // We pass as static fromDate so we always use the same set of rules and
        // so that validity of HCERTs doesn't flip back from invalid to valid in case
        // rules change.
        return validateHCertRules(hcert, businessRules, valueSets, checkTime, fromDate).isValid;
    };

    let fromTimestamp = (timestamp) => {
        return new Date(timestamp);
    };

    let isValidDate = (date) => {
        return !isNaN(date.getTime());
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
    // Max 1000 years
    const maxTime = new Date(fromDate.getTime());
    maxTime.setFullYear(maxTime.getFullYear() + 1000);
    // eslint-disable-next-line no-constant-condition
    while (1) {
        let timestamp = start + offset;
        checkTime = fromTimestamp(timestamp);
        if (!isValidDate(checkTime) || checkTime > maxTime) {
            // If we overflow we check the largest possible date
            // and if that also is valid we give up and assume it
            // can never become invalid
            if (!isValid(maxTime)) {
                checkTime = maxTime;
                break;
            }
            return null;
        }
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
