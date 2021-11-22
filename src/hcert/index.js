import {Validator} from './validate.js';
export {Validator, ValidationResult} from './validate.js';

export const defaultValidator = new Validator(new Date(), true);
