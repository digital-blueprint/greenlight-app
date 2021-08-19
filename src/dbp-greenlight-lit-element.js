import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {getStackTrace} from "@dbp-toolkit/common/error";
import {send} from "@dbp-toolkit/common/notification";
import {parseGreenPassQRCode} from "./utils";


export default class DBPGreenlightLitElement extends DBPLitElement {
    constructor() {
        super();
        this.isSessionRefreshed = false;
        this.auth = {};
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
            "manualCheckRequired": this.isCheckmarkChecked
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
    async decodeUrl(data) {
        const i18n = this._i18n;
        let passData;
        try {
            passData = parseGreenPassQRCode(data, this.searchHashString);
        } catch(error) {
            let checkAlreadySend = await this.wrongQR.includes(data);
            if (checkAlreadySend) {
                const that = this;
                if (!this.resetWrongQr) {
                    this.resetWrongQr = true;
                    setTimeout( function () {
                        that.wrongQR.splice(0,that.wrongQR.length);
                        that.wrongQR.length = 0;
                        that.resetWrongQr = false;
                    }, 3000);
                }
                return false;
            }
            this.wrongQR.push(data);
            send({
                "summary": i18n.t('green-pass-activation.invalid-qr-code-title'),
                "body":  i18n.t('green-pass-activation.invalid-qr-code-body'),
                "type": "danger",
                "timeout": 5,
            });
            return false;
        }

        this.greenPassHash = passData;

        let gpAlreadySend = await this.wrongHash.includes(this.greenPassHash);
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
            //this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'ActivationFailedNoGreenPassHash'});
            return;
        }

        let responseData = await this.sendActivationRequest(greenPassHash);
        await this.checkActivationResponse(responseData, greenPassHash, category, precheck);
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
        this.loading = true;

        let key, salt, cipher, iv;
        let uid = this.auth['person-id'];

        cipher = localStorage.getItem("dbp-gp-" + uid);
        salt = localStorage.getItem("dbp-gp-salt-" + uid);
        iv = localStorage.getItem("dbp-gp-iv-" + uid);

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

        [key, salt] = await this.generateKey(this.auth['subject'], salt_bytes);


        let hash = await this.decrypt(cipher, key, iv_bytes);

        console.log("hash", hash);

        if (hash && typeof hash !== 'undefined' && hash != -1) {
            let check = this.decodeUrl(hash);
            if (check) {
                console.log("check if hash is valid hash and noch nicht abgelaufen");
                this.greenPassHash = hash;
                await this.doActivation(this.greenPassHash, "checkForValidHash", true);
            } else {
                console.error("wrong hash saved");
            }
        }
        this.loading = false;
    }

    async encryptAndSaveHash() {
        let key, salt, cipher, iv;
        let uid = this.auth['person-id'];

        [key, salt] = await this.generateKey(this.auth['subject']);
        [cipher, iv] = await this.encrypt(key, this.greenPassHash);

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

    async generateKey(string, salt = window.crypto.getRandomValues(new Uint8Array(24))) {
        let password = string;

        let enc = new TextEncoder();

        let privateKey = await window.crypto.subtle.importKey(
            "raw",
            enc.encode(password),
            "PBKDF2",
            false,
            ["deriveBits", "deriveKey"]
        );


        let key = await window.crypto.subtle.deriveKey(
            {
                "name": "PBKDF2",
                "salt": salt,
                "iterations": 100000,
                "hash": "SHA-256"
            },
            privateKey,
            { "name": "AES-GCM", "length": 256},
            true,
            [ "encrypt", "decrypt" ]
        );

        let binary = '';
        for (let i = 0; i < salt.byteLength; i++) {
            binary += String.fromCharCode( salt[ i ] );
        }

        let saltBase64 = window.btoa( binary );

        return [key, saltBase64];
    }

    async encrypt(key, plaintext) {
        let enc = new TextEncoder();
        let iv = window.crypto.getRandomValues(new Uint8Array(24));

        let cipher = await window.crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv,
            },
            key,
            enc.encode(plaintext)
        );

        let binary = '';
        let bytes = new Uint8Array( cipher );
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode( bytes[ i ] );
        }

        let cipherBase64 = window.btoa( binary );

        binary = '';
        for (let i = 0; i < iv.byteLength; i++) {
            binary += String.fromCharCode( iv[ i ] );
        }

        let ivBase64 = window.btoa( binary );

        return [cipherBase64, ivBase64];
    }

    async decrypt(ciphertext, key, iv) {
        if (!ciphertext || !key || !iv) {
            console.error("Input for decryption not completely");
            return -1;
        }
        let binary_string =  window.atob(ciphertext);
        let bytes = new Uint8Array( binary_string.length );
        for (let i = 0; i < binary_string.length; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        let cipherArrayBuffer = bytes.buffer;

        let dec = new TextDecoder("utf-8");
        let plaintext = await window.crypto.subtle.decrypt(
                        {
                            name: "AES-GCM",
                            iv: iv,
                        },
                        key,
                        cipherArrayBuffer
                    ).catch(error => {
                        console.error("Decryption error");
                        //console.error(error);
        });

        if (plaintext instanceof Error) {
            console.error("Decryption error");
            return -1;
        }
        // console.log("decrypt: ", dec.decode(plaintext));
        return dec.decode(plaintext);
    }
}