import certlogic from 'certlogic-js';

/**
 * Decodes the Austrian version of the value sets
 *
 * @param {object} hcert 
 * @param {object} trustData 
 * @param {string} trustAnchor 
 * @param {Date} dateTime 
 * @returns {Array}
 */
export async function decodeValueSets(hcert, trustData, trustAnchor, dateTime)
{
    let decoded = hcert.SignedDataDownloader.loadValueSets(trustAnchor, trustData['valuesets'], trustData['valuesetssig']);
    // FIXME: Should we fail here?
    if (dateTime < new Date(decoded.first.validFrom) || dateTime > new Date(decoded.first.validUntil)) {
        console.warn('value set not yet valid or not valid anymore');
    }
    let result = [];
    for (const entry of decoded.second.valueSets) {
        result.push(JSON.parse(entry.valueSet));
    }
    return result;
}

/**
 * Decode the Austrian version of the business rules
 * 
 * @param {object} hcert 
 * @param {object} trustData 
 * @param {string} trustAnchor 
 * @param {Date} dateTime 
 * @returns {Array}
 */
export async function decodeBusinessRules(hcert, trustData, trustAnchor, dateTime)
{
    let decoded = hcert.SignedDataDownloader.loadBusinessRules(trustAnchor, trustData['rules'], trustData['rulessig']);
    // FIXME: Should we fail here?
    if (dateTime < new Date(decoded.first.validFrom) || dateTime > new Date(decoded.first.validUntil)) {
        console.warn('trust list not yet valid or not valid anymore');
    }
    let result = [];
    for (const entry of decoded.second.rules) {
        result.push(JSON.parse(entry.rule));
    }
    return result;
}

/**
 * Converts an array of value sets to something certlogic can work with
 * 
 * @param {Array} valueSets 
 * @returns {Array}
 */
export function valueSetsToLogic(valueSets)
{
    let logicInput = {};
    for(const set of valueSets) {
        logicInput[set.valueSetId] = Object.keys(set.valueSetValues);
    }
    return logicInput;
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

/**
 * Filters a list of rules based on country and region
 * 
 * @param {Array} rules 
 * @param {string} country 
 * @param {string} region 
 * @returns {Array}
 */
export function filterRules(rules, country, region) {
    let filtered = [];
    for(let rule of rules) {
        if (rule.Country == country && rule.Region == region) {
            filtered.push(rule);
        }
    }
    return filtered;
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
 * @param {Array} businessRules 
 * @param {Array} valueSets 
 * @param {Date} dateTime
 * @returns {RuleValidationResult}
 */
export function validateHCertRules(cert, businessRules, valueSets, dateTime)
{
    let logicInput = {
        payload: cert,
        external: {
            valueSets: valueSets,
            validationClock: dateTime.toISOString(),
        }
    };

    let errors = [];
    for(let rule of businessRules) {
        // FIXME: should we ignore rules not valid at that time, or should we fail?
        if (dateTime < new Date(rule.validFrom) || dateTime > new Date(rule.validTo)) {
            console.warn(`rule ${rule.Identifier} not valid anymore`);
        }
        let result = certlogic.evaluate(rule.Logic, logicInput);
        if (!result) {
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
