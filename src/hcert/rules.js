import certlogic from 'certlogic-js';
import cbor from 'cbor-web';

/**
 * Fetches the Austrian version of the value sets
 * 
 * @returns {Array}
 */
async function fetchValueSets()
{
    let r = await fetch('https://dgc-trust.qr.gv.at/valuesets');
    console.assert(r.ok);
    let decoded = await cbor.decodeFirst(await r.arrayBuffer());
    let result = [];
    for (const entry of decoded.v) {
        result.push(JSON.parse(entry.v));
    }
    return result;
}

/**
 * Fetches the Austrian version of the business rules
 *
 * @returns {Array}
 */
async function fetchBusinessRules()
{
    let r = await fetch('https://dgc-trust.qr.gv.at/rules');
    console.assert(r.ok);
    let decoded = await cbor.decodeFirst(await r.arrayBuffer());
    let result = [];
    for (const entry of decoded.r) {
        result.push(JSON.parse(entry.r));
    }
    return result;
}

/**
 * Converts an array of value sets to something certlogic can work with
 * 
 * @param {Array} valueSets 
 * @returns {Array}
 */
function valueSetsToLogic(valueSets)
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
function filterRules(rules, country, region) {
    let filtered = [];
    for(let rule of rules) {
        if (rule.Country == country && rule.Region == region) {
            filtered.push(rule);
        }
    }
    return filtered;
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
 * @throws
 */
function validateHCertRules(cert, businessRules, valueSets, dateTime)
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
        let result = certlogic.evaluate(rule.Logic, logicInput);
        if (!result) {
            errors.push(getRuleErrorDescription(rule));
        }
    }

    if (errors.length) {
        throw new Error("One or more rules failed:\n" + errors.join("\n"));
    }
}

async function test() {
    // just for testing
    let businessRules = filterRules(await fetchBusinessRules(), 'AT', 'ET');
    let valueSets = valueSetsToLogic(await fetchValueSets());
    let currentDateTime = new Date();

    let DATA = JSON.parse(`
    {
        "ver": "1.0.0",
        "nam": {
            "fn": "Musterfrau-Gößinger",
            "fnt": "MUSTERFRAU<GOESSINGER",
            "gn": "Gabriele",
            "gnt": "GABRIELE"
        },
        "dob": "1998-02-26",
        "v": [
            {
                "tg": "840539006",
                "vp": "1119305005",
                "mp": "EU/1/20/1528",
                "ma": "ORG-100030215",
                "dn": 1,
                "sd": 2,
                "dt": "2021-02-18",
                "co": "AT",
                "is": "BMSGPK Austria",
                "ci": "urn:uvci:01:AT:10807843F94AEE0EE5093FBC254BD813P"
            }
        ]
    }`);

    validateHCertRules(DATA, businessRules, valueSets, currentDateTime);
}