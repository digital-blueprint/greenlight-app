import {Validator} from './validate.js';
export {Validator, ValidationResult, RegionResult} from './validate.js';

export const defaultValidator = new Validator(new Date(), true);
