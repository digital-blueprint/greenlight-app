import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {getStackTrace} from "@dbp-toolkit/common/error";
import {send} from "@dbp-toolkit/common/notification";
import {parseGreenPassQRCode} from "./utils";
import {hcertValidation} from "./hcert";
import stringSimilarity from "string-similarity";
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
     * @param date
     * @returns {string} readable date
     */
    getReadableDate(startDate, endDate) {
        const i18n = this._i18n;
        let newDate1 = new Date(startDate);
        let newDate2 = new Date(endDate);
        let newDate = new Date(newDate2 - newDate1);

        let hours = newDate.getHours();
        let minutes = newDate.getMinutes();

        let result = i18n.t('show-active-tickets.valid-until-message-1');
        result += hours > 0 ? i18n.t('show-active-tickets.valid-until-message-2', { hours: hours }) : i18n.t('show-active-tickets.valid-until-message-3', { minutes: ("0" + minutes).slice(-2) });

        return result;
    }



    /**
     * Decode data from QR code
     * Check if it is a valid string for this application with this.searchHashString
     * Saves invalid QR codes, so we don't have to process than more than once
     * Check if input QR code is already a invalid QR code
     *
     * @param data
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
        this.message = i18n.t('acquire-3g-ticket.invalid-qr-code');
    }

    /**
     * Decode data from QR code
     * Check if it is a valid string for this application with this.searchHashString
     * Saves invalid QR codes, so we don't have to process than more than once
     * Check if input QR code is already a invalid QR code
     *
     * @param data
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

        let key, salt, cipher, iv;
        let uid = this.auth['person-id'];

        cipher = localStorage.getItem("dbp-gp-" + uid);
        salt = localStorage.getItem("dbp-gp-salt-" + uid);
        iv = localStorage.getItem("dbp-gp-iv-" + uid);

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
            const i18n = this._i18n;

            if (!this.preCheck) {
                this.message = i18n.t('acquire-3g-ticket.found-valid-selftest');
            } else {
                this.message = i18n.t('acquire-3g-ticket.found-valid-selftest-preCheck');
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

        let responseData = await hcertValidation(greenPassHash);
        await this.checkActivationResponse(responseData, greenPassHash, category, precheck);
    }


    /**
     * Parse the response of a green pass activation request
     * Include message for user when it worked or not
     * Saves invalid QR codes in array in this.wrongHash, so no multiple requests are send
     *
     * Possible paths: activation, refresh session, invalid input, green pass hash wrong
     * no permissions, any other errors, green pass hash empty
     *
     * @param responseData
     * @param greenPassHash
     * @param category
     * @param preCheck
     */
    async checkActivationResponse(responseData, greenPassHash, category, preCheck) {
        const i18n = this._i18n;

        let status = responseData.status;
        let responseBody = responseData.data;
        switch (status) {
            case 201:
                // Check Person
                if (this.auth && this.auth.person && !await this.checkPerson(responseBody.firstname, responseBody.lastname, responseBody.dob, this.auth.person.givenName, this.auth.person.familyName, this.auth.person.birthDate))
                {
                    if (!preCheck) {
                        send({
                            "summary": i18n.t('acquire-3g-ticket.failed-activation-wrong-person-title'),
                            "body": i18n.t('acquire-3g-ticket.failed-activation-wrong-person-body'),
                            "type": "warning",
                            "timeout": 5,
                        });
                    }

                    this.proofUploadFailed = true;
                    this.hasValidProof = false;
                    this.message = i18n.t('acquire-3g-ticket.not-same-person');
                    return;

                }

                this.person.firstname = responseBody.firstname;
                this.person.lastname = responseBody.lastname;
                this.person.dob = responseBody.dob;

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
                    console.log("Found a proof in local storage");
                    this.storeCertificate = true;
                    if (this._("#store-cert-mode")) {
                        this._("#store-cert-mode").checked = true;
                    }
                    this.message = i18n.t('acquire-3g-ticket.found-valid-3g-preCheck');
                } else {
                    this.message = i18n.t('acquire-3g-ticket.found-valid-3g');
                }
                break;
            case 403: // HCert has expired
                this.proofUploadFailed = true;
                this.hasValidProof = false;
                this.message = i18n.t('acquire-3g-ticket.hcert-invalid');
                if (!preCheck)
                    this.saveWrongHashAndNotify(i18n.t('acquire-3g-ticket.hcert-invalid-title'), i18n.t('acquire-3g-ticket.hcert-invalid-body', greenPassHash));
                break;
            case 422: // HCert has expired
                this.proofUploadFailed = true;
                this.hasValidProof = false;
                this.message = i18n.t('acquire-3g-ticket.hcert-invalid');
                if (!preCheck)
                    this.saveWrongHashAndNotify(i18n.t('acquire-3g-ticket.hcert-invalid-title'), i18n.t('acquire-3g-ticket.hcert-invalid-body', greenPassHash));
                break;
            case 500: // Can't process Data
                this.proofUploadFailed = true;
                this.hasValidProof = false;
                this.message = i18n.t('acquire-3g-ticket.cannot-process-data');
                if (!preCheck)
                    this.saveWrongHashAndNotify(i18n.t('acquire-3g-ticket.cannot-process-data-title'), i18n.t('acquire-3g-ticket.cannot-process-data-body', greenPassHash));
                break;
            // Error: something else doesn't work
            default:
                this.proofUploadFailed = true;
                this.hasValidProof = false;
                this.message = i18n.t('acquire-3g-ticket.validate-error');
                if (!preCheck)
                    this.saveWrongHashAndNotify(i18n.t('acquire-3g-ticket.validate-error-title'), i18n.t('acquire-3g-ticket.validate-error-body', greenPassHash));
                //this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'ActivationFailed', 'name': locationName});
                break;
        }
    }

    /**
     * Splits a birthday string.
     *
     * @param string | null string
     * @returns {Array} birthdate
     */
    async splitBirthdayString(string)
    {
        let parts = string.split('-');
        let birthdate = {};
        birthdate.year = parts[0] ? parts[0] : null;
        birthdate.month = parts[1] ? parts[1] : null;
        birthdate.day = parts[2] ? parts[2] : null;

        return birthdate;
    }



    /**
     * Compares two birthday strings.
     *
     * @param {?string} string1 - an empty string, only a day, day and month or the full birthdate
     * @param {?string} string2 - an empty string, only a day, day and month or the full birthdate
     * @returns {(number | boolean)} matcher - returns the maximal matching number
     */
    async compareBirthdayStrings(string1, string2)
    {
        if (string1 === null || string1 === '' || string2 === null || string2 === '') {
            // if a birthday is not set, return true
            return true;
        }
        let parts1 = await this.splitBirthdayString(string1);
        let parts2 = await this.splitBirthdayString(string2);
        let matcher = 0;

        if (parts1.day && parts2.day && parts1.day !== parts2.day) {
            // if days are set but don't match, return false
            return false;
        } else {
            matcher = matcher + 1;
            if (parts1.month && parts2.month && parts1.month !== parts2.month) {
                // if months are set but don't match, return false
                return false;
            } else {
                matcher = matcher + 1;
                if (parts1.year !== parts2.year) {
                    // if years don't match, return false
                    return false;
                }
            }
        }
        matcher = matcher + 1;


        return matcher;
    }

    /**
     * Checks if a person is another person
     *
     * @param {string} firstName
     * @param {string} lastName
     * @param {string} dob
     * @param {string} personFirstName
     * @param {string} personLastName
     * @param {string} personDob
     * @returns {boolean} - returns if the person mathes with the other person
     */
    async checkPerson(firstName, lastName, dob, personFirstName, personLastName, personDob) {
        let match = await this.compareBirthdayStrings(personDob, dob);
        if (!match) {
            return false;
        }


        // if birdthdate could be checked in day, month and year then we can lower the impact of the name matching
        const percent = match === 3 ? 80 : 50;

        let firstNameSimilarityPercent = 0;
        // check firstname if there is one set in the certificate
        if (firstName !== "") {

            let personFirstNameShorted = personFirstName.split(" ");
            let firstNameShorted = firstName.split(" ");
            firstNameSimilarityPercent = stringSimilarity.compareTwoStrings(personFirstNameShorted[0], firstNameShorted[0]) * 100;

            if (personFirstNameShorted[1] !== null && firstNameSimilarityPercent <= match) {
                firstNameSimilarityPercent = stringSimilarity.compareTwoStrings(personFirstNameShorted[1], firstNameShorted[0]) * 100;
            }
            if (firstNameShorted[1] !== null && firstNameSimilarityPercent <= match) {
                firstNameSimilarityPercent = stringSimilarity.compareTwoStrings(personFirstNameShorted[0], firstNameShorted[1]) * 100;
            }
            if (firstNameShorted[1] !== null && personFirstNameShorted[1] !== null && firstNameSimilarityPercent <= match) {
                firstNameSimilarityPercent = stringSimilarity.compareTwoStrings(personFirstNameShorted[1], firstNameShorted[1]) * 100;
            }
            // return false if firstname isn't similar enough
            if (firstNameSimilarityPercent < percent) {
                return false;
            }
        }
        let lastNameSimilarityPercent = stringSimilarity.compareTwoStrings(lastName, personLastName) * 100;

        // return false if lastname isn't similar enough
        return lastNameSimilarityPercent >= percent;
    }

    async encryptAndSaveHash() {
        let key, salt, cipher, iv;
        let uid = this.auth['person-id'];

        [key, salt] = await generateKey(this.auth['subject']);
        [cipher, iv] = await encrypt(key, this.greenPassHash);

        if (navigator.storage && navigator.storage.persist) {
            navigator.storage.persist().then(function(persistent) {
                if (persistent)
                    console.log("Storage will not be cleared except by explicit user action");
                else
                    console.log("Storage may be cleared by the UA under storage pressure.");
            });
        }
        

        localStorage.setItem("dbp-gp-" + uid, cipher);
        localStorage.setItem("dbp-gp-salt-" + uid, salt);
        localStorage.setItem("dbp-gp-iv-" + uid, iv);
    }

    async clearLocalStorage() {
        let uid = this.auth['person-id'];

        localStorage.removeItem("dbp-gp-" + uid);
        localStorage.removeItem("dbp-gp-salt-" + uid);
        localStorage.removeItem("dbp-gp-iv-" + uid);
    }
}