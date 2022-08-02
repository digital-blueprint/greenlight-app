import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {getStackTrace} from '@dbp-toolkit/common/error';
import {send} from '@dbp-toolkit/common/notification';
import {combineURLs} from '@dbp-toolkit/common';
import {parseGreenPassQRCode, i18nKey} from './utils';
import {defaultValidator, ValidationResult, RegionResult} from './hcert';
import {checkPerson} from './hcertmatch.js';
import {encodeAdditionalInformation} from './crypto.js';
import * as storage from './storage.js';
import {createInstance, addTranslations} from './i18n.js';

export default class DBPGreenlightLitElement extends DBPLitElement {
    constructor() {
        super();
        addTranslations(this._i18n);
        this.isSessionRefreshed = false;
        this.auth = {};
        this.person = {};

        this.searchHashString = '';
        this.searchSelfTestStringArray = '';
        this.selfTestValid = false;
        this.ticketTypes = {full: 'ET'};
    }

    _hasMultipleTicketTypes() {
        return this.ticketTypes['full'] !== undefined && this.ticketTypes['partial'] !== undefined;
    }

    static get properties() {
        return {
            ...super.properties,
            auth: {type: Object},

            searchSelfTestStringArray: {
                type: String,
                attribute: 'gp-search-self-test-string-array',
            },
            searchHashString: {type: String, attribute: 'gp-search-hash-string'},
            selfTestValid: {type: Boolean, attribute: 'gp-self-test-valid'},
            ticketTypes: {type: Object, attribute: 'ticket-types'},
        };
    }

    connectedCallback() {
        super.connectedCallback();

        this._loginStatus = '';
        this._loginState = [];
        this._loginCalled = false;
    }

    /**
     *  Request a re-render every time isLoggedIn()/isLoading() changes
     */
    _updateAuth() {
        this._loginStatus = this.auth['login-status'];

        let newLoginState = [this.isLoggedIn(), this.isLoading()];

        if (this._loginState.toString() !== newLoginState.toString()) {
            this.requestUpdate();
        }

        this._loginState = newLoginState;

        if (this.isLoggedIn() && !this._loginCalled && this.hasPermissions()) {
            this._loginCalled = true;
            this.loginCallback();
        }
    }

    loginCallback() {
        // Implement in subclass
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'auth':
                    this._updateAuth();
                    break;
            }
        });

        super.update(changedProperties);
    }

    /**
     * Returns if a person is set in or not
     *
     * @returns {boolean} true or false
     */
    isLoggedIn() {
        return this.auth.person !== undefined && this.auth.person !== null;
    }

    /**
     * Returns true if a person has successfully logged in
     *
     * @returns {boolean} true or false
     */
    isLoading() {
        if (this._loginStatus === 'logged-out') return false;

        return !this.isLoggedIn() && this.auth.token !== undefined;
    }

    hasPermissions() {
        if (!this.auth.person || !Array.isArray(this.auth.person.roles)) return false;

        if (this.auth.person.roles.includes('ROLE_SCOPE_GREENLIGHT')) {
            return true;
        }

        return false;
    }

    /**
     * Send a fetch to given url with given options
     *
     * @param url
     * @param options
     * @returns {object} response (error or result)
     */
    async httpGetAsync(url, options) {
        let response = await fetch(url, options)
            .then((result) => {
                if (!result.ok) throw result;

                return result;
            })
            .catch((error) => {
                return error;
            });

        return response;
    }

    /**
     * Sends an analytics error event for the request of a room
     *
     * @param category
     * @param action
     * @param information
     * @param responseData
     */
    async sendErrorAnalyticsEvent(category, action, information, responseData = {}) {
        let responseBody = {};
        // Use a clone of responseData to prevent "Failed to execute 'json' on 'Response': body stream already read"
        // after this function, but still a TypeError will occur if .json() was already called before this function
        try {
            responseBody = await responseData.clone().json();
        } catch (e) {
            responseBody = responseData; // got already decoded data
        }

        const data = {
            status: responseData.status || '',
            url: responseData.url || '',
            description: responseBody['hydra:description'] || '',
            errorDetails: responseBody['relay:errorDetails'] || '',
            information: information,
            // get 5 items from the stack trace
            stack: getStackTrace().slice(1, 6),
        };

        this.sendSetPropertyEvent('analytics-event', {
            category: category,
            action: action,
            name: JSON.stringify(data),
        });
    }

    /**
     * Sends an analytics success event for the request of a room
     *
     * @param category
     * @param action
     * @param information
     */
    async sendSuccessAnalyticsEvent(category, action, information) {
        const data = {
            information: information,
        };

        this.sendSetPropertyEvent('analytics-event', {
            category: category,
            action: action,
            name: JSON.stringify(data),
        });
    }

    async sendCreateTicketRequest() {
        let additionalInformation;

        if (this._hasMultipleTicketTypes() && this.hasValidProof) {
            additionalInformation = this.isFullProof ? 'full' : 'partial';
        } else if (!this._hasMultipleTicketTypes() && this.hasValidProof && !this.isSelfTest) {
            additionalInformation = 'local-proof';
        } else {
            additionalInformation = '';
        }

        let body = {
            consentAssurance: this.isConfirmChecked,
            //"additionalInformation": await encodeAdditionalInformation(this.auth.token, this.hasValidProof && !this.isSelfTest ? 'local-proof' : ''),
            additionalInformation: await encodeAdditionalInformation(
                this.auth.token,
                additionalInformation
            ),
        };

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + this.auth.token,
            },
            body: JSON.stringify(body),
        };

        return await this.httpGetAsync(
            combineURLs(this.entryPointUrl, '/greenlight/permits'),
            options
        );
    }

    saveWrongHashAndNotify(title, body, hash, notificationType = 'danger') {
        send({
            summary: title,
            body: body,
            type: notificationType,
            timeout: 5,
        });

        if (this.wrongHash) this.wrongHash.push(hash);
    }

    formatValidUntilDate(date) {
        return date.toLocaleDateString('de-DE', {
            day: 'numeric',
            year: 'numeric',
            month: 'numeric',
        });
    }

    formatValidUntilTime(date) {
        return date.toLocaleTimeString('de-DE', {
            hour: 'numeric',
            minute: 'numeric',
        });
    }

    async checkAlreadySend(data, reset, wrongQrArray, title = '', body = '', message = '') {
        const i18n = this._i18n;
        title = title === '' ? i18n.t('acquire-3g-ticket.invalid-title') : title;
        body = body === '' ? i18n.t('acquire-3g-ticket.invalid-body') : body;
        let checkAlreadySend = await wrongQrArray.includes(data);

        if (checkAlreadySend) {
            if (!reset) {
                reset = true;
                setTimeout(function () {
                    wrongQrArray.splice(0, wrongQrArray.length);
                    wrongQrArray.length = 0;
                    reset = false;
                }, 3000);
            }
        } else {
            wrongQrArray.push(data);
            if (!this.preCheck) {
                send({
                    summary: title,
                    body: body,
                    type: 'danger',
                    timeout: 5,
                });
                this.proofUploadFailed = true;
                this.message =
                    message !== '' ? message : i18nKey('acquire-3g-ticket.invalid-qr-body');
            }
        }
    }

    /**
     * wrapping function for parsing the Hashdata with the function parseGreenPassQRCode
     *
     * @param data
     * @param searchHashString
     * @returns {boolean} true if data is valid greenpass QR Code
     * @returns {boolean} false if data is invalid greenpass QR Code
     */
    async tryParseHash(data, searchHashString) {
        try {
            parseGreenPassQRCode(data, searchHashString);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Checks if a specific data is already validated before and resets the array where its saved to get
     * again a notification after 3 seconds
     *
     * This function is a migitation for not spaming the screen with notifications
     *
     * @param data
     * @returns {boolean} true if data is already checked
     * @returns {boolean} false if data is not checked in the last 3 seconds
     */
    async isAlreadyChecked(data) {
        let alreadyChecked = false;

        if (this.wrongHash !== undefined) alreadyChecked = await this.wrongHash.includes(data);

        if (alreadyChecked) {
            const that = this;

            if (!this.resetWrongHash) {
                this.resetWrongHash = true;
                setTimeout(function () {
                    that.wrongHash.splice(0, that.wrongHash.length);
                    that.wrongHash.length = 0;
                    that.resetWrongHash = false;
                }, 3000);
            }
        }
        return alreadyChecked;
    }

    async checkForValidProofLocal() {
        this.greenPassHash = '';

        try {
            let hash = null;

            try {
                hash = await storage.fetch(this.auth['person-id'], this.auth['subject']);
            } catch (error) {
                console.log('checkForValidProofLocal Error', error);
            }

            if (hash !== null) {
                await this.checkQRCode(hash);
            }
        } finally {
            if (this.preCheck) this.preCheck = false;
        }
    }

    async checkQRCode(data) {
        if (await this.isAlreadyChecked(data)) return;

        let check = await this.tryParseHash(data, this.searchHashString);

        if (check) {
            this.greenPassHash = data;
            this.isSelfTest = false;
            this.hasValidProof = true;
            this.isFullProof = false;

            this.proofUploadFailed = false;
            await this.doActivation(this.greenPassHash, 'ActivationRequest', this.preCheck);
            return;
        }

        let selfTestURL = '';
        if (this.searchSelfTestStringArray && this.searchSelfTestStringArray !== '') {
            const array = this.searchSelfTestStringArray.split(',');
            for (const selfTestString of array) {
                check = await this.tryParseHash(data, selfTestString);
                if (check) {
                    selfTestURL = data;
                    break;
                }
            }
        }

        if (check && selfTestURL !== '' && !this.selfTestValid) {
            const i18n = this._i18n;
            await this.checkAlreadySend(
                data.data,
                this.resetWrongQr,
                this.wrongQR ? this.wrongQR : [],
                i18n.t('self-test-not-supported-title'),
                i18n.t('self-test-not-supported-body'),
                i18n.t('self-test-not-supported-title')
            );
            return;
        }

        if (check && selfTestURL !== '') {
            if (!this.preCheck) {
                this.message = i18nKey('acquire-3g-ticket.found-valid-selftest');
            } else {
                this.message = i18nKey('acquire-3g-ticket.found-valid-selftest-preCheck');
            }

            this.isSelfTest = true;
            this.greenPassHash = selfTestURL;

            if (this.showQrContainer !== undefined && this.showQrContainer !== false) {
                this.stopQRReader();
                this.QRCodeFile = null;
                this.showQrContainer = false;
            }

            this.hasValidProof = true;
            this.proofUploadFailed = false;
            this.isFullProof = false;

            if (this._('#text-switch')) this._('#text-switch')._active = '';

            this.showCreateTicket = true;
            if (this._('#trust-button') && this._('#trust-button').checked) {
                await this.encryptAndSaveHash();
            }
        } else {
            if (this.wrongQR !== undefined)
                await this.checkAlreadySend(data.data, this.resetWrongQr, this.wrongQR);
        }
    }

    /**
     * Sends an activation request and do error handling and parsing
     * Include message for user when it worked or not
     * Saves invalid QR codes in array in this.wrongHash, so no multiple requests are send
     *
     * Possible paths: activation, invalid input, gp hash wrong
     * no permissions, any other errors, gp hash empty
     *
     * @param greenPassHash
     * @param category
     * @param precheck
     */
    async doActivation(greenPassHash, category, precheck = false) {
        const i18n = this._i18n;
        this.detailedError = '';

        // Error: no valid hash detected
        if (greenPassHash.length <= 0) {
            if (!precheck) {
                this.message = i18nKey('acquire-3g-ticket.invalid-qr-body');
                this.saveWrongHashAndNotify(
                    i18n.t('acquire-3g-ticket.invalid-title'),
                    i18n.t('acquire-3g-ticket.invalid-body'),
                    greenPassHash
                );
            }
            return;
        }

        await this.checkActivationResponse(greenPassHash, category, precheck);
    }

    /**
     * Parse the response of a green pass activation request
     * Include message for user when it worked or not
     * Saves invalid QR codes in array in this.wrongHash, so no multiple requests are send
     *
     * Possible paths: activation, refresh session, invalid input, green pass hash wrong
     * no permissions, any other errors, green pass hash empty
     *
     * @param greenPassHash
     * @param category
     * @param preCheck
     */
    async checkActivationResponse(greenPassHash, category, preCheck = false) {
        const i18n = this._i18n;

        let regions = Object.values(this.ticketTypes);
        let fullProofRegion = this.ticketTypes['full'] ?? 'ET';
        let errorRegion = this.ticketTypes['partial'] ?? fullProofRegion;

        /** @type {ValidationResult} */
        let res;
        try {
            res = await defaultValidator.validate(
                greenPassHash,
                new Date(),
                this.lang,
                'AT',
                regions
            );
            this.validationFailed = false;
        } catch (error) {
            // Validation wasn't possible (Trust data couldn't be loaded, signatures are broken etc.)
            console.error('ERROR:', error);
            await this.sendErrorAnalyticsEvent('HCertValidation', 'DataError', '');
            this.validationFailed = true;
            this.proofUploadFailed = true;
            this.hasValidProof = false;
            this.isFullProof = false;
            this.detailedError = error.message;
            this.message = i18nKey('validation-not-possible');
            this.saveWrongHashAndNotify(
                i18n.t('validation-not-possible-title'),
                i18n.t('validation-not-possible-body'),
                greenPassHash
            );
            return;
        }

        // HCert has expired or is invalid
        if (!res.isValid) {
            await this.sendErrorAnalyticsEvent('HCertValidation', 'Expired', '');
            this.proofUploadFailed = true;
            this.hasValidProof = false;
            this.isFullProof = false;
            if (!preCheck) {
                // Iterate through all errors and use the description in the language we prefere the most
                let getTranslatedErrors = (errors) => {
                    let languages = i18n.languages + ['en'];
                    let translated = [];
                    for (let error of errors) {
                        let text = 'unknown';
                        let prio = -1;
                        for (let [ln, desc] of Object.entries(error)) {
                            let thisPrio = languages.indexOf(ln);
                            if (prio === -1) {
                                text = desc;
                                prio = thisPrio;
                            } else if (thisPrio !== -1 && thisPrio < prio) {
                                text = desc;
                                prio = thisPrio;
                            }
                        }
                        translated.push(text);
                    }
                    translated.sort();
                    return translated;
                };

                this.detailedError = i18n.t(res.errorKey, {error: getTranslatedErrors(res.error).join('\n')});
                this.saveWrongHashAndNotify(
                    i18n.t('acquire-3g-ticket.invalid-title'),
                    i18n.t('acquire-3g-ticket.invalid-body'),
                    greenPassHash
                );
                this.message = i18nKey('acquire-3g-ticket.invalid-document');
            }
            return;
        }

        /** @type {RegionResult[]} */
        let validRegions = [];
        for (let region of regions) {
            if (res.regions[region].isValid) {
                validRegions.push(res.regions[region]);
            }
        }

        // HCert has expired according ot the "ET" rules
        /** @type {RegionResult} */
        if (!validRegions.length) {
            await this.sendErrorAnalyticsEvent('HCertValidation', 'Expired', '');
            this.proofUploadFailed = true;
            this.hasValidProof = false;
            if (!preCheck) {
                // Use the less strict region for the error message to show what would be needed
                // to get at least something.
                this.detailedError = i18n.t(res.regions[errorRegion].errorKey, {error: getTranslatedErrors(res.regions[errorRegion].error).join('\n')});
                this.saveWrongHashAndNotify(
                    i18n.t('acquire-3g-ticket.invalid-title'),
                    i18n.t('acquire-3g-ticket.invalid-body'),
                    greenPassHash
                );
                this.message = i18nKey('acquire-3g-ticket.invalid-document');
            }
            return;
        }

        // HCert is valid
        if (this.auth) {
            // Fetch the currently logged in person
            let personId = this.auth['person-id'];
            const options = {
                method: 'GET',
                headers: {
                    Authorization: 'Bearer ' + this.auth.token,
                },
            };
            let response = await this.httpGetAsync(
                combineURLs(this.entryPointUrl, '/base/people/' + encodeURIComponent(personId)),
                options
            );
            let person = await response.json();

            // Make sure the person matches the proof
            if (
                !checkPerson(
                    res.firstname,
                    res.lastname,
                    res.firstname_t,
                    res.lastname_t,
                    res.dob,
                    person.givenName,
                    person.familyName,
                    person.birthDate
                )
            ) {
                if (!preCheck) {
                    this.saveWrongHashAndNotify(
                        i18n.t('acquire-3g-ticket.invalid-title'),
                        i18n.t('acquire-3g-ticket.invalid-body'),
                        greenPassHash
                    );
                    this.message = i18nKey('acquire-3g-ticket.not-same-person');
                }
                this.proofUploadFailed = true;
                this.hasValidProof = false;
                this.isFullProof = false;
                await this.sendSuccessAnalyticsEvent('HCertValidation', 'NameDoesntMatch', '', '');
                return;
            }
        }

        if (this._('#trust-button') && this._('#trust-button').checked) {
            await this.encryptAndSaveHash();
        }

        // XXX: We use the earliest validUntil available since we can't display more of them.
        // Assuming the rules are a subset of each other then this doesn't change anything.
        let earliestValidUntil = validRegions[0].validUntil;
        for (let entry of validRegions) {
            if (entry.validUntil < earliestValidUntil) {
                earliestValidUntil = entry.validUntil;
            }
        }

        this.person.firstname = res.firstname;
        this.person.lastname = res.lastname;
        this.person.dob = res.dob;
        this.person.validUntil = earliestValidUntil;

        if (this.showQrContainer !== undefined && this.showQrContainer !== false) {
            this.stopQRReader();
            this.QRCodeFile = null;
            this.showQrContainer = false;
        }

        this.hasValidProof = true;
        this.proofUploadFailed = false;
        this.isSelfTest = false;

        this.isFullProof = false;
        for (let entry of validRegions) {
            if (entry.region == fullProofRegion) {
                this.isFullProof = true;
            }
        }

        if (this._('#text-switch')) this._('#text-switch')._active = '';
        this.showCreateTicket = true;

        if (preCheck) {
            this.message = i18nKey('acquire-3g-ticket.found-valid-3g-preCheck');
        } else {
            this.message = i18nKey('acquire-3g-ticket.found-valid-3g');
        }
        await this.sendSuccessAnalyticsEvent('HCertValidation', 'Success', '');
    }

    async persistStorageMaybe() {
        if (navigator.storage && navigator.storage.persist) {
            if (await navigator.storage.persist())
                console.log('Storage will not be cleared except by explicit user action');
            else console.log('Storage may be cleared by the UA under storage pressure.');
        }
    }

    async encryptAndSaveHash() {
        // We don't want to await here since it's easy for the user to miss the
        // permission popup in Firefox while the ticket creation is in progress,
        // and this also breaks e2e tests in cypress + some versions of firefox
        this.persistStorageMaybe();

        let expiresAt;
        if (this.isSelfTest) {
            expiresAt = Date.now() + 60000 * 1440; //24 hours
        }
        await storage.save(
            this.greenPassHash,
            this.auth['person-id'],
            this.auth['subject'],
            expiresAt
        );
    }

    async clearLocalStorage() {
        await storage.clear(this.auth['person-id']);
    }
}
