import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {getStackTrace} from "@dbp-toolkit/common/error";
import {send} from "@dbp-toolkit/common/notification";
import {parseGreenPassQRCode, i18nKey} from "./utils";
import {hcertValidation} from "./hcert";
import {checkPerson} from "./hcertmatch.js";
import {generateKey, encrypt, decrypt} from "./crypto.js";

export default class DBPGreenlightLitElement extends DBPLitElement {
    constructor() {
        super();
        this.isSessionRefreshed = false;
        this.auth = {};

        this.person = {};
    }

    static get properties() {
        return {
            ...super.properties,
            auth: { type: Object },
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
            // NOP
        }

        const data = {
            status: responseData.status || '',
            url: responseData.url || '',
            description: responseBody['hydra:description'] || '',
            room: room,
            // get 5 items from the stack trace
            stack: getStackTrace().slice(1, 6)
        };

        // console.log("sendErrorEvent", data);
        this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': action, 'name': JSON.stringify(data)});
    }

    /**
     * Sends a request to get all certificates
     *
     * @returns {object} response
     */
    async sendGetCertificatesRequest() {
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + this.auth.token
            },
        };

        return await this.httpGetAsync(this.entryPointUrl + '/eu-dcc/digital-covid-certificate-reviews', options);
    }

    async sendCreateTicketRequest() {
        let body = {
            // "place": this.location,
            "consentAssurance": this.isConfirmChecked, //or always hardcoded true?
            "additionalInformation": this.hasValidProof && !this.isSelfTest ? 'local-proof' : '',
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
     * @returns {string} readable date
     * @param startDate
     * @param endDate
     */
    getReadableDuration(startDate, endDate) {
        const i18n = this._i18n;
        let newDate1 = new Date(startDate);
        let newDate2 = new Date(endDate);
        const diff_minutes = (newDate2 - newDate1)/1000/60;
        const diff_hours = diff_minutes/60;

        let result = i18n.t('show-active-tickets.valid-until-message-1');
        result += diff_hours > 0 ? i18n.t('show-active-tickets.valid-until-message-2', { hours: diff_hours }) : i18n.t('show-active-tickets.valid-until-message-3', { minutes: ("0" + diff_minutes).slice(-2) });

        return result;
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
        } catch(error) {
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
                setTimeout( function () {
                    that.wrongHash.splice(0,that.wrongHash.length);
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

                setTimeout( function () {
                    wrongQrArray.splice(0,wrongQrArray.length);
                    wrongQrArray.length = 0;
                    reset = false;
                }, 3000);
            }
        }
        wrongQrArray.push(data);
        send({
            "summary": i18n.t('green-pass-activation.invalid-qr-code-title'),
            "body":  i18n.t('green-pass-activation.invalid-qr-code-body'),
            "type": "danger",
            "timeout": 5,
        });
        this.proofUploadFailed = true;
        this.message = i18nKey('acquire-3g-ticket.invalid-qr-code');
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
        let passData;
        try {
            passData = parseGreenPassQRCode(data, searchHashString);
            console.log("passdata", passData);
        } catch(error) {

            return false;
        }
        let gpAlreadySend = false;
        if (this.wrongHash !== undefined)
            gpAlreadySend = await this.wrongHash.includes(data);
        if (gpAlreadySend) {
            const that = this;
            if (!this.resetWrongHash) {
                this.resetWrongHash = true;
                setTimeout( function () {
                    that.wrongHash.splice(0,that.wrongHash.length);
                    that.wrongHash.length = 0;
                    that.resetWrongHash = false;
                }, 3000);
            }
        }

        return !gpAlreadySend;
    }


    async checkForValidProof() {

        this.loading = true;

        let responseData = await this.sendGetCertificatesRequest();
        let status = responseData.status;
        let responseBody = await responseData.clone().json();

        if (status === 200) { //TODO switch/case
            console.log('received items: ', responseBody['hydra:totalItems']);
            if (responseBody['hydra:totalItems'] > 0) {
                this.isActivated = true;
                this.activationEndTime = responseBody['hydra:member'][0]['expires'];
                this.identifier = responseBody['hydra:member'][0]['identifier'];
                console.log('Found a valid 3G proof for the current user.');
                this.hasValidProof = true;
                this.proofUploadFailed = false;
            } else {
                this.hasValidProof = false;
                console.log('Found no valid 3G proof for the current user.');
            }
        } else { //TODO request returned an error
            send({
                "summary": responseBody['hydra:title'],
                "body": responseBody['hydra:description'],
                "type": "danger",
                "timeout": 5,
            });
        }

        this.loading = false;
    }

    async checkForValidProofLocal() {
        this.greenPassHash = '';
        console.log("checkForValidProofLocal");
        this.loading = true;

        let key, salt, cipher, iv, maxTime;
        let uid = this.auth['person-id'];

        cipher = localStorage.getItem("dbp-gp-" + uid);
        salt = localStorage.getItem("dbp-gp-salt-" + uid);
        iv = localStorage.getItem("dbp-gp-iv-" + uid);
        maxTime = localStorage.getItem("dbp-gp-maxTime-" + uid);

        if (maxTime) {
            let actualTime = Date.now();

            if (actualTime - maxTime >= 0) {
                await this.clearLocalStorage();
                console.log("Selftest invalid", actualTime - maxTime);
                this.loading = false;
                if (this.preCheck)
                    this.preCheck = false;
            }
        }

        try {
            let salt_binary_string =  window.atob(salt);
            let salt_bytes = new Uint8Array( salt_binary_string.length );
            for (let i = 0; i < salt_binary_string.length; i++)        {
                salt_bytes[i] = salt_binary_string.charCodeAt(i);
            }

            let iv_binary_string =  window.atob(iv);
            let iv_bytes = new Uint8Array( iv_binary_string.length );
            for (let i = 0; i < iv_binary_string.length; i++)        {
                iv_bytes[i] = iv_binary_string.charCodeAt(i);
            }

            [key, salt] = await generateKey(this.auth['subject'], salt_bytes);


            let hash = await decrypt(cipher, key, iv_bytes);
            if (hash && typeof hash !== 'undefined' && hash !== -1) {
                await this.checkQRCode(hash);
            }
            this.loading = false;
            if (this.preCheck)
                this.preCheck = false;
        } catch (error) {
            console.log("checkForValidProofLocal Error", error);
            this.loading = false;
            if (this.preCheck)
                this.preCheck = false;
        }

    }

    async checkQRCode(data) {
        let check = await this.decodeUrlWithoutCheck(data, this.searchHashString);
        if (check) {
            this.greenPassHash = data;
            console.log("gp", this.greenPassHash);
            this.isSelfTest = false;
            this.hasValidProof = true;
            this.proofUploadFailed = false;

            await this.doActivation(this.greenPassHash, 'ActivationRequest', this.preCheck);
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
            if ( this._("#trust-button") && this._("#trust-button").checked && !this.isUploadSkipped)
            {
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
        // Error: no valid hash detected
        if (greenPassHash.length <= 0) {
            this.saveWrongHashAndNotify(i18n.t('green-pass-activation.invalid-qr-code-title'), i18n.t('green-pass-activation.invalid-qr-code-body'), greenPassHash);
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
    async checkActivationResponse(greenPassHash, category, preCheck) {
        const i18n = this._i18n;

        let responseData = await hcertValidation(greenPassHash);

        let status = responseData.status;
        let responseBody = responseData.data;
        switch (status) {
            case 201:
                // Check Person
                if (this.auth && this.auth.person && !checkPerson(responseBody.firstname, responseBody.lastname, responseBody.dob, this.auth.person.givenName, this.auth.person.familyName, this.auth.person.birthDate))
                {
                   /* if (!preCheck) {
                        send({
                            "summary": i18n.t('acquire-3g-ticket.failed-activation-wrong-person-title'),
                            "body": i18n.t('acquire-3g-ticket.failed-activation-wrong-person-body'),
                            "type": "warning",
                            "timeout": 5,
                        });
                    }*/
                    if ( this._("#trust-button") && this._("#trust-button").checked && !this.isUploadSkipped)
                    {
                        await this.encryptAndSaveHash();
                    }
                    this.proofUploadFailed = true;
                    this.hasValidProof = false;
                    this.message = i18nKey('acquire-3g-ticket.not-same-person');
                    return;

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

                this.isSelfTest = false;

                if (this._("#text-switch"))
                    this._("#text-switch")._active = "";
                this.showCreateTicket = true;


                if (preCheck) {
                    console.log("Found an evidence in local storage");
                    this.storeCertificate = true;
                    if (this._("#store-cert-mode")) {
                        this._("#store-cert-mode").checked = true;
                    }
                    this.message = i18nKey('acquire-3g-ticket.found-valid-3g-preCheck');
                } else {
                    this.message = i18nKey('acquire-3g-ticket.found-valid-3g');
                }
                break;
            case 403: // HCert has expired
                this.proofUploadFailed = true;
                this.hasValidProof = false;
                this.message = i18nKey('acquire-3g-ticket.hcert-invalid');
                if (!preCheck)
                    this.saveWrongHashAndNotify(i18n.t('acquire-3g-ticket.hcert-invalid-title'), i18n.t('acquire-3g-ticket.hcert-invalid-body', greenPassHash));
                break;
            case 422: // HCert has expired
                this.proofUploadFailed = true;
                this.hasValidProof = false;
                this.message = i18nKey('acquire-3g-ticket.hcert-invalid');
                if (!preCheck)
                    this.saveWrongHashAndNotify(i18n.t('acquire-3g-ticket.hcert-invalid-title'), i18n.t('acquire-3g-ticket.hcert-invalid-body', greenPassHash));
                break;
            case 500: // Can't process Data
                this.proofUploadFailed = true;
                this.hasValidProof = false;
                this.message = i18nKey('acquire-3g-ticket.cannot-process-data');
                if (!preCheck)
                    this.saveWrongHashAndNotify(i18n.t('acquire-3g-ticket.cannot-process-data-title'), i18n.t('acquire-3g-ticket.cannot-process-data-body', greenPassHash));
                break;
            // Error: something else doesn't work
            default:
                this.proofUploadFailed = true;
                this.hasValidProof = false;
                this.message = i18nKey('acquire-3g-ticket.validate-error');
                if (!preCheck)
                    this.saveWrongHashAndNotify(i18n.t('acquire-3g-ticket.validate-error-title'), i18n.t('acquire-3g-ticket.validate-error-body', greenPassHash));
                //this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'ActivationFailed', 'name': locationName});
                break;
        }
    }

    async encryptAndSaveHash() {
        let key, salt, cipher, iv;
        let uid = this.auth['person-id'];

        [key, salt] = await generateKey(this.auth['subject']);
        [cipher, iv] = await encrypt(key, this.greenPassHash);

        if (navigator.storage && navigator.storage.persist) {
            if (await navigator.storage.persist())
                console.log("Storage will not be cleared except by explicit user action");
            else
                console.log("Storage may be cleared by the UA under storage pressure.");
        }

        localStorage.setItem("dbp-gp-" + uid, cipher);
        localStorage.setItem("dbp-gp-salt-" + uid, salt);
        localStorage.setItem("dbp-gp-iv-" + uid, iv);
        if (this.isSelfTest) {
            localStorage.setItem("dbp-gp-maxTime-" + uid, Date.now() + 60000*1440); //24 hours
        }

    }

    async clearLocalStorage() {
        let uid = this.auth['person-id'];

        localStorage.removeItem("dbp-gp-" + uid);
        localStorage.removeItem("dbp-gp-salt-" + uid);
        localStorage.removeItem("dbp-gp-iv-" + uid);
        localStorage.removeItem("dbp-gp-maxTime-" + uid);

    }
}