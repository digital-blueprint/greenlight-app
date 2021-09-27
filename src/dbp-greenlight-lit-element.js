import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {getStackTrace} from "@dbp-toolkit/common/error";
import {send} from "@dbp-toolkit/common/notification";
import {parseGreenPassQRCode, i18nKey} from "./utils";
import {hcertValidation} from "./hcert";
import {checkPerson} from "./hcertmatch.js";
import {encodeAdditionalInformation} from "./crypto.js";
import * as storage from "./storage.js";
import * as tgct from "./tgct";

export default class DBPGreenlightLitElement extends DBPLitElement {
    constructor() {
        super();
        this.isSessionRefreshed = false;
        this.auth = {};
        this.person = {};

        this.searchHashString = '';
        this.searchHashInternalTestString = '';
        this.searchSelfTestStringArray = '';
    }

    static get properties() {
        return {
            ...super.properties,
            auth: {type: Object},

            searchSelfTestStringArray: {type: String, attribute: 'gp-search-self-test-string-array'},
            searchHashInternalTestString: {type: String, attribute: 'gp-search-hash-internal-test-string'},
            searchHashString: {type: String, attribute: 'gp-search-hash-string'},
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

        if (this.isLoggedIn() && !this._loginCalled) {
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
                case "auth":
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
        return (this.auth.person !== undefined && this.auth.person !== null);
    }

    /**
     * Returns true if a person has successfully logged in
     *
     * @returns {boolean} true or false
     */
    isLoading() {
        if (this._loginStatus === "logged-out")
            return false;

        return (!this.isLoggedIn() && this.auth.token !== undefined);
    }

    hasPermissions() {
        if (!this.auth.person || !Array.isArray(this.auth.person.roles))
            return false;

        if (this.auth.person.roles.includes('ROLE_STUDENT'))
            return true;

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
        let response = await fetch(url, options).then(result => {

            if (!result.ok) throw result;

            return result;
        }).catch(error => {
            return error;
        });

        return response;
    }

    /**
     * Sends an analytics error event for the request of a room
     *
     * @param category
     * @param action
     * @param room
     * @param responseData
     */
    async sendErrorAnalyticsEvent(category, action, room, responseData = {}) {
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
            room: room,
            // get 5 items from the stack trace
            stack: getStackTrace().slice(1, 6)
        };

        this.sendSetPropertyEvent('analytics-event', {
            'category': category,
            'action': action,
            'name': JSON.stringify(data)
        });
    }

    async sendCreateTicketRequest() {
        let body = {
            // "place": this.location,
            "consentAssurance": this.isConfirmChecked,
            "additionalInformation": await encodeAdditionalInformation(this.auth.token, this.hasValidProof && !this.isSelfTest ? 'local-proof' : ''),
        };

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + this.auth.token
            },
            body: JSON.stringify(body)
        };

        return await this.httpGetAsync(this.entryPointUrl + '/greenlight/permits', options);
    }

    saveWrongHashAndNotify(title, body, hash) {
        send({
            "summary": title,
            "body": body,
            "type": "danger",
            "timeout": 5,
        });

        if (this.wrongHash)
            this.wrongHash.push(hash);
    }

    /**
     * Parse a incoming date to a readable date
     *
     * @param date
     * @returns {string} readable date
     */
    getReadableDate(date) {
        const i18n = this._i18n;
        let newDate = new Date(date);
        let month = newDate.getMonth() + 1;

        return i18n.t('valid-till', {clock: newDate.getHours() + ":" + ("0" + newDate.getMinutes()).slice(-2)}) + " " + newDate.getDate() + "." + month + "." + newDate.getFullYear();
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

    /**
     * Decode data from QR code
     * Check if it is a valid string for this application with this.searchHashString
     * Saves invalid QR codes, so we don't have to process than more than once
     * Check if input QR code is already a invalid QR code
     *
     * @param data
     * @param searchHashString
     * @param hash
     * @returns {boolean} true if data is valid not yet send QR code data
     * @returns {boolean} false if data is invalid QR code data
     */
    async decodeUrl(data, searchHashString, hash) {
        let passData;
        try {
            passData = parseGreenPassQRCode(data, searchHashString);
        } catch (error) {
            if (this.wrongQR !== undefined)
                await this.checkAlreadySend(data, this.resetWrongQr, this.wrongQR);
            return false;
        }

        this.greenPassHash = passData;

        let gpAlreadySend = false;

        if (this.wrongHash !== undefined)
            gpAlreadySend = await this.wrongHash.includes(data);

        if (gpAlreadySend) {
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

        return !gpAlreadySend;
    }

    async checkAlreadySend(data, reset, wrongQrArray) {
        const i18n = this._i18n;

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
        }

        wrongQrArray.push(data);
        send({
            "summary": i18n.t('acquire-3g-ticket.invalid-title'),
            "body": i18n.t('acquire-3g-ticket.invalid-body'),
            "type": "danger",
            "timeout": 5,
        });
        this.proofUploadFailed = true;
        this.message = i18nKey('acquire-3g-ticket.invalid-qr-body');
    }

    /**
     * Decode data from QR code
     * Check if it is a valid string for this application with this.searchHashString
     * Saves invalid QR codes, so we don't have to process than more than once
     * Check if input QR code is already a invalid QR code
     *
     * @param data
     * @param searchHashString
     * @returns {boolean} true if data is valid not yet send QR code data
     * @returns {boolean} false if data is invalid QR code data
     */
    async decodeUrlWithoutCheck(data, searchHashString) {
        try {
            parseGreenPassQRCode(data, searchHashString);
        } catch (error) {
            return false;
        }

        let gpAlreadySend = false;

        if (this.wrongHash !== undefined)
            gpAlreadySend = await this.wrongHash.includes(data);

        if (gpAlreadySend) {
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

        return !gpAlreadySend;
    }

    async checkForValidProofLocal() {
        this.greenPassHash = '';

        try {
            let hash = null;

            try {
                hash = await storage.fetch(this.auth['person-id'], this.auth['subject']);
            } catch (error) {
                console.log("checkForValidProofLocal Error", error);
            }

            if (hash !== null) {
                await this.checkQRCode(hash);
            }
        } finally {
            if (this.preCheck)
                this.preCheck = false;
        }
    }

    async checkQRCode(data) {
        let check = await this.decodeUrlWithoutCheck(data, this.searchHashString);
        let check2 = check ? false : await this.decodeUrlWithoutCheck(data, this.searchHashInternalTestString);

        if (check || check2) {
            this.greenPassHash = data;
            this.isSelfTest = false;
            this.isInternalTest = check2 ? true : false;
            this.hasValidProof = true;
            this.proofUploadFailed = false;
            await this.doActivation(this.greenPassHash, 'ActivationRequest', this.preCheck, this.isInternalTest);
            return;
        }

        let selfTestURL = '';
        const array = this.searchSelfTestStringArray.split(",");
        for (const selfTestString of array) {
            check = await this.decodeUrlWithoutCheck(data, selfTestString);
            if (check) {
                selfTestURL = data;
                break;
            }
        }

        if (check && selfTestURL !== '') {
            if (!this.preCheck) {
                this.message = i18nKey('acquire-3g-ticket.found-valid-selftest');
            } else {
                this.message = i18nKey('acquire-3g-ticket.found-valid-selftest-preCheck');
            }

            this.isSelfTest = true;
            this.isInternalTest = false;
            this.greenPassHash = selfTestURL;

            if (this.showQrContainer !== undefined && this.showQrContainer !== false) {
                this.stopQRReader();
                this.QRCodeFile = null;
                this.showQrContainer = false;
            }

            this.hasValidProof = true;
            this.proofUploadFailed = false;

            if (this._("#text-switch"))
                this._("#text-switch")._active = "";

            this.showCreateTicket = true;
            if (this._("#trust-button") && this._("#trust-button").checked) {
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
     * @param internalTest
     */
    async doActivation(greenPassHash, category, precheck = false, internalTest = false) {
        const i18n = this._i18n;
        this.detailedError = '';

        // Error: no valid hash detected
        if (greenPassHash.length <= 0) {
            this.message = i18nKey('acquire-3g-ticket.invalid-qr-body');
            this.saveWrongHashAndNotify(i18n.t('acquire-3g-ticket.invalid-title'), i18n.t('acquire-3g-ticket.invalid-body'), greenPassHash);
            return;
        }

        await this.checkActivationResponse(greenPassHash, category, precheck, internalTest);
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
     * @param internalTest
     */
    async checkActivationResponse(greenPassHash, category, preCheck = false, internalTest = false) {
        const i18n = this._i18n;

        let responseData = internalTest ? await tgct.tgctValidation(greenPassHash, this.lang) : await hcertValidation(greenPassHash, this.lang);
        let status = responseData.status;
        let responseBody = responseData.data;
        switch (status) {
            case 201:
                // Check Person
                if (this.auth && this.auth.person && !checkPerson(responseBody.firstname, responseBody.lastname, responseBody.dob, this.auth.person.givenName, this.auth.person.familyName, this.auth.person.birthDate)) {
                    if (!preCheck) {
                        /* send({
                             "summary": i18n.t('acquire-3g-ticket.invalid-title'),
                             // "body": i18n.t('acquire-3g-ticket.invalid-body'),
                             "type": "warning",
                             "timeout": 5,
                         });*/
                        this.message = i18nKey('acquire-3g-ticket.not-same-person');
                    }
                    this.proofUploadFailed = true;
                    this.hasValidProof = false;
                    return;

                }
                if (this._("#trust-button") && this._("#trust-button").checked) {
                    await this.encryptAndSaveHash();
                }
                this.person.firstname = responseBody.firstname;
                this.person.lastname = responseBody.lastname;
                this.person.dob = responseBody.dob;
                this.person.validUntil = responseBody.validUntil;

                if (this.showQrContainer !== undefined && this.showQrContainer !== false) {
                    this.stopQRReader();
                    this.QRCodeFile = null;
                    this.showQrContainer = false;
                }

                this.hasValidProof = true;
                this.proofUploadFailed = false;
                this.isInternalTest = internalTest;
                this.isSelfTest = false;

                if (this._("#text-switch"))
                    this._("#text-switch")._active = "";
                this.showCreateTicket = true;

                if (preCheck) {
                    this.message = i18nKey('acquire-3g-ticket.found-valid-3g-preCheck');
                } else {
                    this.message = i18nKey('acquire-3g-ticket.found-valid-3g');
                }
                break;
            case 422: // HCert has expired
                await this.sendErrorAnalyticsEvent('HCertValidation', 'Expired', '', responseData);
                this.proofUploadFailed = true;
                this.hasValidProof = false;
                this.message = i18nKey('acquire-3g-ticket.invalid-document');
                this.detailedError = responseData.error;
                if (!preCheck)
                    this.saveWrongHashAndNotify(i18n.t('acquire-3g-ticket.invalid-title'), i18n.t('acquire-3g-ticket.invalid-body', greenPassHash));
                break;
            case 500: // Can't process Data
                await this.sendErrorAnalyticsEvent('HCertValidation', 'DataError', '', responseData);
                this.proofUploadFailed = true;
                this.hasValidProof = false;
                this.message = i18nKey('acquire-3g-ticket.invalid-document');
                this.detailedError = responseData.error;
                if (!preCheck)
                    this.saveWrongHashAndNotify(i18n.t('acquire-3g-ticket.invalid-title'), i18n.t('acquire-3g-ticket.invalid-body', greenPassHash));
                break;
            // Error: something else doesn't work
            default:
                await this.sendErrorAnalyticsEvent('HCertValidation', 'UnknownError', '', responseData);
                this.proofUploadFailed = true;
                this.hasValidProof = false;
                this.message = i18nKey('acquire-3g-ticket.invalid-document');
                this.detailedError = responseData.error;
                if (!preCheck)
                    this.saveWrongHashAndNotify(i18n.t('acquire-3g-ticket.invalid-title'), i18n.t('acquire-3g-ticket.invalid-body', greenPassHash));
                break;
        }
    }

    async encryptAndSaveHash() {
        if (navigator.storage && navigator.storage.persist) {
            if (await navigator.storage.persist())
                console.log("Storage will not be cleared except by explicit user action");
            else
                console.log("Storage may be cleared by the UA under storage pressure.");
        }

        let expiresAt;
        if (this.isSelfTest) {
            expiresAt = Date.now() + 60000 * 1440; //24 hours
        }
        await storage.save(this.greenPassHash, this.auth['person-id'], this.auth['subject'], expiresAt);
    }

    async clearLocalStorage() {
        await storage.clear(this.auth['person-id']);
    }
}