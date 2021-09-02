import {Validator} from './validate.js';
export {Validator, ValidationResult} from './validate.js';

/**
 * FIXME: remove this function,
 * this is just a shim to provide a similar interface to the server one.
 * 
 * Use Validator/ValidationResult directly.
 *
 * @param {string} hc1 
 * @returns {object}
 */
export async function hcertValidation(hc1)
{
    let result = {
        status: -1,
        error: null,
        data : {
            firstname: null,
            lastname: null,
            dob: null,
            validUntil: null,
        }
    };

    let res;
    try {
        let validator = new Validator();
        res = await validator.validate(hc1, new Date(), true);
    } catch (error) {
        result.status = 500;
        result.error = error.message;
        console.log("errror", error);
        return result;
    }

    if (res.isValid) {
        result.status = 201;
        result.data.firstname = res.firstname;
        result.data.lastname = res.lastname;
        result.data.dob = res.dob;
        result.data.validUntil = res.validUntil;
    } else {
        result.status = 422;
        result.error = res.error;
    }

    return result;
}
